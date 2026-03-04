# R2 存储规范化完整指南

## 📋 存储规范

| 文件类型 | 存储桶 | 路径前缀 | 示例 |
|---------|--------|---------|------|
| 视频 (.mp4) | VIDEOS | `videos/` | `videos/empty-your-mind.mp4` |
| 音频 (.mp3) | R2 | `audio/` | `audio/Canada_Provinces_and_Territories.mp3` |
| 封面 (.jpg/.png) | R2 | `thumbnails/` | `thumbnails/Canada_Provinces_and_Territories.jpg` |

---

## 🚀 快速开始

### 一键执行（推荐）

```bash
cd /Users/a/dictation
chmod +x scripts/standardize_r2_complete.sh
./scripts/standardize_r2_complete.sh
```

这个脚本会按顺序执行所有步骤。

---

## 📝 手动执行步骤

### 步骤 1：检查 R2 文件分布

```bash
python3 scripts/check_r2_files.py
```

**输出示例：**
```
📦 Bucket: engnovate-audio
  audio/Canada_Provinces_and_Territories.mp3     2.34 MB
  thumbnails/Canada_Provinces_and_Territories.jpg   45 KB

📦 Bucket: engnovate-videos
  videos/empty-your-mind.mp4                    15.67 MB
```

---

### 步骤 2：清理和迁移文件

```bash
python3 scripts/cleanup_and_migrate_r2.py
```

**执行内容：**
1. 扫描 R2 和 VIDEOS 两个桶
2. 识别错误放置的文件
3. 迁移到正确的桶
4. 删除原位置的重复文件

**示例：**
- R2 桶中的 `videos/xxx.mp4` → 迁移到 VIDEOS 桶
- VIDEOS 桶中的 `audio/xxx.mp3` → 迁移到 R2 桶
- VIDEOS 桶中的 `thumbnails/xxx.jpg` → 迁移到 R2 桶

---

### 步骤 3：更新 Cloudflare Worker

#### 3.1 配置存储桶绑定

登录 https://dash.cloudflare.com/

**Workers & Pages** → **r2-proxy** → **Settings** → **Bindings**

添加两个 R2 存储桶绑定：

**绑定 1（R2 桶）：**
- Variable name: `R2`
- Bucket name: `engnovate-audio`
- 勾选 **Encrypt**

**绑定 2（VIDEOS 桶）：**
- Variable name: `VIDEOS`
- Bucket name: `engnovate-videos`
- 勾选 **Encrypt**

#### 3.2 更新 Worker 代码

1. 点击 **Edit code**
2. 复制 `workers/r2-router-smart.js` 的内容
3. 粘贴到 Worker 编辑器
4. **Save** → **Deploy**

---

### 步骤 4：测试 Worker

```bash
# 测试音频（应该返回 200）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/audio/Canada_Provinces_and_Territories.mp3"

# 测试封面（应该返回 200）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/Canada_Provinces_and_Territories.jpg"

# 测试视频（应该返回 200）
curl -I "https://r2-proxy.suxiaoshuang2020.workers.dev/videos/empty-your-mind.mp4"
```

**成功的响应应该包含：**
```
HTTP/2 200
X-Bucket: R2 或 VIDEOS
X-Key: audio/xxx.mp3
Content-Type: audio/mpeg
```

---

### 步骤 5：修复 Supabase 路径

```bash
python3 scripts/fix_supabase_r2_paths.py
```

**执行内容：**
1. 读取所有 materials
2. 识别相对路径
3. 转换为 R2 Worker URL
4. 更新数据库

**示例转换：**
- `audio/xxx.mp3` → `https://r2-proxy.../audio/xxx.mp3`
- `thumbnails/xxx.jpg` → `https://r2-proxy.../thumbnails/xxx.jpg`
- `videos/xxx.mp4` → `https://r2-proxy.../videos/xxx.mp4`

---

## 🔍 验证结果

### 检查存储桶

```bash
python3 scripts/check_r2_files.py
```

**预期结果：**
- R2 桶：只有 `audio/` 和 `thumbnails/` 文件
- VIDEOS 桶：只有 `videos/` 文件

### 检查数据库

```bash
python3 -c "
from supabase import create_client
client = create_client('https://cuxotlijjnxbsirpdkgr.supabase.co', 'sb_publishable_E14-9O-p9jZqfL6ikHARsQ_l6zTiwNr')
result = client.table('materials').select('title, audio_path, thumbnail_path').limit(3).execute()
for m in result.data:
    print(f\"{m['title']}\")
    print(f\"  audio: {m['audio_path'][:60]}...\")
    print(f\"  thumb: {m['thumbnail_path']}\")
"
```

**预期结果：**
- 所有路径都是 `https://r2-proxy...` 开头的完整 URL
- 路径前缀正确：`audio/`, `thumbnails/`, `videos/`

### 测试前端

访问以下页面：

1. **素材列表**：https://xiaoshuangsu.github.io/dictation-shadowing-tool/topics
   - 应该能看到封面图
   - 不应该有 404 错误

2. **练习页面**：https://xiaoshuangsu.github.io/dictation-shadowing-tool/topics/dictation/first-snowfall
   - 音频/视频应该能播放
   - 移动端和 PC 端都能正常访问

---

## ⚠️ 常见问题

### Q: Worker 返回 "Bucket not configured"

**A:** 存储桶未绑定。检查 Cloudflare Worker → Settings → Bindings

### Q: Worker 返回 "File not found"

**A:** 文件未上传到正确的桶。运行 `python3 scripts/check_r2_files.py` 检查

### Q: 数据库路径格式错误

**A:** 运行 `python3 scripts/fix_supabase_r2_paths.py` 修复

### Q: 移动端图片无法加载

**A:** 检查 Worker 响应头是否包含 `Access-Control-Allow-Origin: *`

---

## 📊 文件清单

| 文件 | 用途 |
|------|------|
| `scripts/standardize_r2_complete.sh` | 一键执行脚本 |
| `scripts/check_r2_files.py` | 检查 R2 文件分布 |
| `scripts/cleanup_and_migrate_r2.py` | 清理和迁移文件 |
| `scripts/fix_supabase_r2_paths.py` | 修复数据库路径 |
| `workers/r2-router-smart.js` | 智能 Worker 路由代码 |

---

## ✅ 完成检查清单

- [ ] 步骤 1：检查文件分布
- [ ] 步骤 2：清理和迁移完成
- [ ] 步骤 3：Worker 已绑定两个存储桶
- [ ] 步骤 3：Worker 代码已更新
- [ ] 步骤 4：Worker 测试通过（返回 200）
- [ ] 步骤 5：数据库路径已修复
- [ ] 前端页面测试通过
- [ ] 移动端测试通过

---

## 🎯 预期结果

完成后，你应该看到：

1. **存储桶干净**：没有重复文件
2. **Worker 正常**：所有资源返回 200
3. **数据库正确**：所有路径指向 R2 Worker
4. **前端可用**：素材和练习页面正常
5. **移动端兼容**：iOS Safari 可以正常访问

---

## 💡 维护建议

**新增素材时：**
1. 视频上传到 VIDEOS 桶
2. 音频和封面上传到 R2 桶
3. 数据库使用 R2 Worker URL

**定期检查：**
```bash
python3 scripts/check_r2_files.py
```

**如果发现重复：**
```bash
python3 scripts/cleanup_and_migrate_r2.py
```
