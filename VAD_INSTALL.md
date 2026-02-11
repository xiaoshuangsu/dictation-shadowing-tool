# 音频切分工具 - 安装说明

## 1. 安装 ffmpeg（必需）

### macOS:
```bash
brew install ffmpeg
```

### 如果没有 Homebrew:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 2. 安装 Python 依赖

```bash
pip3 install pydub
```

## 3. 运行脚本

```bash
cd /Users/a/dictation
python3 vad_detect_silence.py
```

## 4. 输出说明

脚本会生成 `draft_config.json` 文件，格式如下：

```json
{
  "title": "First Snowfall",
  "audio_file": "learn-english-via-listening-1001.mp3",
  "total_duration": 84.3,
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 2.5,
      "duration": 2.5,
      "text": "[Segment 1] (2.5s)",
      "start_ms": 0,
      "end_ms": 2500
    }
  ],
  "stats": {
    "total_segments": 22,
    "total_duration": 84.3,
    "avg_segment_duration": 3.8
  }
}
```

## 5. 下一步

1. 编辑 `draft_config.json`，为每个片段填写正确的 `text`
2. 微调 `start` 和 `end` 时间戳
3. 将数据转换为 `sampleSentences` 数组格式并复制到 `src/app/page.tsx`

## 参数调整（如需要）

如果切分不准确，可以调整脚本中的参数：

```python
MIN_SILENCE_LEN = 500  # 增大 = 检测更长静音（更少的片段）
SILENCE_THRESH = -40    # 负值越大 = 检测更严格
MIN_SOUND_LEN = 1000   # 增大 = 忽略更多短片段
```
