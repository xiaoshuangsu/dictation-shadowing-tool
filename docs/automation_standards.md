# 素材与自动化规范

> 本文档包含素材命名、批量导入、自动化流程等规范。
> 使用场景：文件操作、R2 上传、数据库导入时查阅。

---

## 1. 素材命名与去重规范 (Naming & Deduplication)

* **唯一 Slug 标准**：全小写、连字符（如 `daily-vlog`），严禁空格和大写。
* **三位一体对齐**：视频、音频、缩略图的主文件名必须完全一致。
* **物理去重原则 (Strict Cleanup)**：
    - **禁止并存**：严禁同一个素材以不同命名（如 `Trip.mp4` 和 `trip.mp4`）同时存在。
    - **覆盖式更新**：修改命名时，必须先 `Delete` 旧文件，再 `Upload` 新文件。
    - **格式清理**：若 R2 中已存在同名 `.mp4`，必须立即删除残留的 `.webm`。
* **幂等性检查**：上传前对比 MD5 或文件大小，若文件内容一致但命名不同，则执行"重命名并删除旧项"的操作。

* **字符安全强制转换 (Sanitization)**：
    - **严禁**在文件名、Slug、或 R2 路径中使用特殊字符。
    - **自动替换规则**：遇到特殊单引号 `'` (U+2019)、标准单引号 `'`、空格、或任何非 ASCII 字符，必须统一转换为**标准连字符 `-`** 或直接**剔除**。
    - **示例**：`Sarah's Story` 必须转换为 `sarahs-story`，严禁保留 `'`。

---

## 2. 转录核心算法逻辑 (Precision Transcription)

### 2.1 基础规则
* **毫秒级对齐**：Whisper `word_timestamps=True`。
* **物理断句**：
    - 标点 `?.!` 强制切分。
    - 逗号 `,` + 停顿 `> 0.8s` 强制切分。
    - 任何停顿 `> 0.8s` 强制切分。
* **翻译**：指定调用 **GLM API**，确保结合整篇内容根据上下文进行准确翻译，表达地道。

### 2.2 吞音问题解决方案 (Tail Sound Preservation)

#### 问题现象
- 词尾辅音被截断（如 hills 的 /s/、visitors 的 /s/、working 的 /ing/）
- 句子结束太早，导致发音不完整
- 用户体验差，影响影子跟读

#### 根本原因
1. **Whisper 词级时间戳不精确**：词的 `end` 时间可能不包含完整的词尾辅音
2. **零时长词标记错误**：某些词被标记为 `start == end`（如 "hills."）
3. **VAD 静音判定过严**：微弱摩擦音被误判为背景噪音

#### 解决方案：动态冲突检测算法

**核心原则**：
- **动态后扩**：句子结束时间向后延长 `min(300ms, 间隙/2)`
- **静音裁剪**：使用 Whisper 已识别的停顿作为切割点
- **首部锁定**：起始时间最多向前 30ms（防止爆音）

**关键参数**：
```python
PAUSE_THRESHOLD = 0.8        # 停顿阈值（秒）
TAIL_BUFFER = 0.3            # 默认尾部缓冲 300ms
START_BUFFER = 0.03          # 起始时间最多前移 30ms
```

**断句逻辑**：
1. 遇到 `?!.` → 强制断句，应用动态后扩
2. 逗号 + 停顿 > 0.8s → 断句，应用动态后扩
3. 任何停顿 > 0.8s → 断句，在停顿中间位置结束

**VAD 优化参数**：
```python
model.transcribe(
    word_timestamps=True,
    fp16=False,
    no_speech_threshold=0.05,      # 降低静音阈值（默认0.6），保留微弱摩擦音
    logprob_threshold=-2.0,         # 降低概率阈值
    compression_ratio_threshold=3.0, # 提高压缩比容忍度
    condition_on_previous_text=False, # 减少对前文依赖
)
```

#### 实现文件
- 脚本：`scripts/retranscribe_empty_your_mind.py`
- 断句函数：`split_words_to_sentences()`

#### 注意事项
- ❌ 不要盲目加固定缓冲（如 500ms），会导致句子重叠
- ❌ 不要大幅前移起始时间（如 100ms），会听到上一句尾音
- ✅ 使用动态冲突检测，确保每句之间有微小间隙
- ✅ 保留所有字段（如 `translation`），避免数据丢失

---

## 3. 自动化监控流水线 (Watch Media Script)

监控目录 `/Users/a/dictation/public/`：
1. **FFmpeg 压制**：480p (CRF 28-32)。
2. **AI 处理**：生成 Whisper 字幕 (JSON) + GLM 翻译。
3. 获取视频标题并确定难度等级。
4. 抓取封面图并压缩至 20kb 以下。
5. **R2 唯一化上传**：上传前检查桶内是否存在该 Slug 的旧文件，执行覆盖式同步。
6. **数据库对齐**：确保 Supabase 存储的是**相对路径**（如 `videos/b3l3-dialogue.mp4`），由前端 `getCdnUrl()` 自动拼接 Worker 代理。
7. **物理删除（安全锁）**：只有收到 R2 和 Supabase 的"成功双重确认"后，才允许删除本地原始文件。

---

## 4. 批量素材导入 (Engnovate Bulk Import)

**脚本**：`scripts/ingest_bulk.py`
**输入**：`urls.txt`（每行一个 Engnovate URL）
**数据源**：https://engnovate.com/dictation-shadowing-exercises/

### 完整流程（10 步）

| 步骤 | 操作 | 数据来源 |
|------|------|----------|
| 0 | **查重优先** | Supabase `source_url` 字段 |
| 1 | 抓取页面 | Engnovate |
| 2 | 解析标题 | `<h1>` 标签 |
| 3 | 生成 slug | 标题转换（小写+连字符）|
| 4 | 解析音频 | `<audio>` 标签 |
| 5 | 解析时间戳 | `data-start`/`data-duration` ✅ |
| 6 | 下载音频 | 远程 URL |
| 7 | GLM 翻译 | GLM-4-Flash API |
| 8 | 上传 R2 | `audio/{category}/{slug}.mp3` |
| 9 | 存 Supabase | `materials` 表 |
| 10 | 容错记录 | `error.log` |

### 关键特性

**🔍 查重机制**
- 根据 `source_url` 查重，跳过已处理链接
- 优先执行，避免重复工作

**📁 R2 存储结构**
```
audio/
  ├─ daily-life/{slug}.mp3
  ├─ historical-speeches/{slug}.mp3
  └─ ...
```

**⚠️ 容错机制**
- 单个失败不中断整体
- 错误记录到 `error.log`
- 最终统计：成功/失败/总计

### 使用示例
```bash
# 1. 添加 URL
echo "https://engnovate.com/.../radio-stations/" >> urls.txt

# 2. 运行脚本
python scripts/ingest_bulk.py

# 3. 查看错误日志
cat error.log
```

### 数据库字段
- `source_url`：查重依据（Engnovate 原链接）
- `audio_path`：`audio/{category}/{slug}.mp3`
- `category`：固定为"日常生活"
- `difficulty`：固定为 A2

### ⚠️ 标点符号解析问题（已修复）

**问题现象**：挖空练习显示错误
```
❌ 修复前：The sky is blue and water is blue [     ]
✅ 修复后：The sky is [     ] and water is blue.
```

**根本原因**：
- Engnovate HTML 中每个 `<span>` 之间有空格
- 脚本用 `' '.join()` 连接，标点前产生空格：`"blue ."`
- 前端将 `"blue"` 和 `"."` 当作两个独立词

**修复方案**（提交 1c5ab89）：
- 更新 `parse_transcript` 函数
- 标点符号（`.`, `,`, `!`, `?`）直接拼接到前一个单词
- 移除标点前的空格：`"blue ."` → `"blue."`

**修复效果**：
| 修复前 | 修复后 |
|--------|--------|
| `"blue ."`（2 个 token） | `"blue."`（1 个 token） |
| 9 个词 | 8 个词 |
| 挖空位置错误 | 挖空位置正确 |

---

## 5. 路径处理与前端规范 (404 Prevention)

* **禁止拼接**：前端 `practice/page.tsx` 必须通过 `getCdnUrl()` 函数处理数据库中的相对路径。
* **Worker 代理强制要求**：所有素材（视频、音频、缩略图）必须通过 A 账号的 Worker 代理（`https://media.shadowhub.app`）获取。
  - ✅ **原因**：Worker 提供移动端必备的 CORS 头和 Range 请求支持
  - ❌ **禁止**：直接使用 R2 公共域名或 Supabase Storage URL
* **清理脏数据**：发现数据库中带有 R2 公共域名或 Supabase 直连 URL 的记录，一律修正为相对路径（由 `getCdnUrl` 自动拼接 Worker 代理）。

---

## 6. 数据库与脚本健壮性规范 (Database & Script Robustness)

### 6.1 核心字段强制校验 (Mandatory Fields)
* **原则**：在执行任何视频自动化处理脚本（如 `youtube_single.py` 或 `batch_process_ted.py`）时，必须确保存入 Supabase 的 `material_data` 对象包含完整的路径字段。
* **核心字段清单**：
    - `video_path`: 必须包含 R2 的视频访问链接。
    - `audio_path`: 必须包含音频链接。
    - `cover_path` (或 `thumbnail_path`): 必须包含封面图链接。
* **逻辑要求**：脚本在执行 `upsert` 操作前，必须先自检数据结构，严禁在缺少 `video_path` 的情况下提交记录，否则会导致练习页面无法播放。

### 6.2 存量数据修复机制
* **操作要求**：如果发现页面无法显示视频，Claude 应首先检查数据库中对应 `slug` 的 `video_path` 字段是否为空。
* **自动化修复**：若字段缺失，应通过脚本自动提取已上传至 R2 的资源路径并完成补全，而非让用户手动修改数据库。

### 6.3 脚本更新同步
* **同步义务**：一旦修复了脚本中的逻辑漏洞（如补上了缺失的 `video_path` 变量），必须确保该修复已同步到所有相关的批处理脚本中，保持逻辑一致性。

---

## 7. 版本、提交与部署

1. **代码自检**：检查逻辑，确保无 URL 拼接错误。
2. **版本记录**：更新 `package.json` 版本号，手动编写 `CHANGELOG.md`。
3. **Git 流程**：打 Tag -> Commit -> Push 至 GitHub 触发 Pages 更新。

---

## 8. 移动端与跨域资源开发规范 (Mobile & CORS Protocol)

### 8.1 跨域资源强制要求 (CORS Requirements)

* **核心原则**：所有素材必须通过 A 账号 Worker 代理（`https://media.shadowhub.app`）加载。
  - ✅ **Worker 提供的关键能力**：
    - 正确的 CORS 头（`Access-Control-Allow-Origin: *`）
    - Range 请求支持（206 Partial Content）- 移动端播放器分段请求的必备能力
    - R2 直连在 Range 请求方面表现不稳定，Worker 代理完美中转
* **血泪史教训**：
  - R2 公共域名（`pub-*.r2.dev`）**缺少 CORS 头**，导致 iOS/移动端封面显示失败（黑屏）
  - 直接使用 R2 或 Supabase URL 会导致资源加载中断
* **强制动作**：凡是 `<img />`, `<audio />`, `<video />` 标签，**必须**显式添加 `crossOrigin="anonymous"` 属性。
  - ✅ `<video src={url} crossOrigin="anonymous" playsInline />`
* **iOS 特定坑点**：
  - ⚠️ **必须包含 `playsInline` 属性**，否则视频无法内联播放
  - ⚠️ **不能缺失 `crossOrigin="anonymous"` 属性**，即使有 Worker 代理，封面依然会黑屏
  - 这是实测中最耗时的发现
* **路由配置要求**：
  - ✅ **B 账号必须设置 `media.shadowhub.app/*` 路由**

---

**版本**：V19.9
**更新日期**：2026-03-18
