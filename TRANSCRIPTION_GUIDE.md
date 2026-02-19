# Whisper 自动转录说明

## 功能介绍

使用 OpenAI Whisper AI 模型自动为音频素材生成句子级别的转录文本和时间戳。

## 转录流程

1. 从 Supabase 数据库获取素材列表
2. 下载音频文件到本地
3. 使用 Whisper 模型进行语音识别
4. 生成带时间戳的句子数据
5. 更新数据库的 `transcript` 字段

## 前置准备

### 1. 安装依赖

```bash
pip install openai-whisper supabase torch
```

### 2. 运行数据库迁移

在 Supabase SQL Editor 中运行：

```sql
-- 添加 transcript 字段到 materials 表
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS transcript jsonb;
```

或运行迁移文件：

```bash
# 在 Supabase Dashboard → SQL Editor 中运行
# 文件: supabase/migrations/add_transcript_column.sql
```

## 运行转录脚本

### 基本用法

```bash
cd /Users/a/dictation
python transcribe_with_whisper.py
```

### 脚本参数

编辑 `transcribe_with_whisper.py` 修改配置：

```python
# Whisper 模型选择
WHISPER_MODEL = "base"  # 可选: tiny, base, small, medium, large

# tiny:  最快，~1GB RAM，适合测试
# base:  推荐，~1GB RAM，平衡速度和精度
# small: 较好精度，~2GB RAM
# medium: 更好精度，~5GB RAM
# large:  最佳精度，~10GB RAM
```

### 转染时间估算

使用 `base` 模型：
- 1 分钟音频 ≈ 5-10 秒处理时间
- 39 个素材（平均 2 分钟）≈ 10-20 分钟

## 输出格式

转录完成后，`transcript` 字段包含以下 JSON 数据：

```json
[
  {
    "id": 1,
    "text": "First snowfall.",
    "startTime": 0.0,
    "endTime": 1.6
  },
  {
    "id": 2,
    "text": "Today is November 26th.",
    "startTime": 3.6,
    "endTime": 5.6
  }
]
```

## 使用场景

### 场景 1：首次批量转录

```bash
# 转录所有素材（跳过已有转录的）
python transcribe_with_whisper.py
```

### 场景 2：重新转录特定素材

在 Supabase Dashboard 中将 `transcript` 字段清空，然后重新运行脚本。

### 场景 3：手动修正转录

1. 在 Supabase Dashboard → Table Editor → materials
2. 找到对应素材，编辑 `transcript` 字段
3. 修正 JSON 数据中的文本
4. 保存即可生效

## 注意事项

### 内存要求

- `tiny`/`base`: 至少 2GB RAM
- `small`: 至少 4GB RAM
- `medium`: 至少 8GB RAM
- `large`: 至少 16GB RAM

### 网络要求

- 首次运行需要下载 Whisper 模型文件（~150MB for base）
- 需要下载音频文件（总计约 60MB）

### GPU 加速（可选）

如果有 NVIDIA GPU，可以加速转录：

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## 质量优化建议

1. **选择合适的模型**
   - 测试用 `tiny`
   - 生产用 `base` 或 `small`
   - 高精度用 `medium`

2. **后处理修正**
   - 运行脚本后，检查转录质量
   - 在 Supabase Dashboard 中手动修正错误

3. **音频质量**
   - 确保音频清晰、无杂音
   - 避免背景音乐干扰

## 故障排除

### 问题 1: torch 安装失败

```bash
# 使用官方源安装
pip3 install torch torchvision torchaudio
```

### 问题 2: FFmpeg 未找到

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# 下载: https://ffmpeg.org/download.html
```

### 问题 3: 内存不足

- 使用更小的模型（`tiny` 或 `base`）
- 分批处理音频文件

## 验证结果

转录完成后，在素材库页面测试：

1. 访问 `/materials`
2. 点击任意素材的"听写"或"影子"按钮
3. 检查是否显示正确的句子文本
4. 播放音频，验证时间戳准确性

## 相关文件

- `transcribe_with_whisper.py` - 主脚本
- `supabase/migrations/add_transcript_column.sql` - 数据库迁移
- `src/app/page.tsx` - 前端使用 transcript 数据
