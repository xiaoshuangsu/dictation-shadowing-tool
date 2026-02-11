# 🎙️ FFmpeg 安装指南

## 快速安装（推荐）

### 方法 1：使用 Homebrew

打开终端，运行以下命令：

```bash
# 1. 安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装 ffmpeg
brew install ffmpeg

# 3. 验证安装
ffmpeg -version
```

### 方法 2：下载预编译版本

1. 访问：https://evermeet.cx/ffmpeg/
2. 下载 "ffmpeg.X.X.X.zip"
3. 解压并移到 `/usr/local/bin/`：
   ```bash
   sudo mv ffmpeg /usr/local/bin/
   sudo chmod +x /usr/local/bin/ffmpeg
   ```

### 方法 3：使用 conda（如果已安装）

```bash
conda install ffmpeg
```

## 安装完成后

```bash
cd /Users/a/dictation
python3 vad_detect_silence.py
```

## 脚本说明

**vad_detect_silence.py** 会自动：

1. ✅ 检测音频中的静音部分
2. ✅ 切分出有效语音片段
3. ✅ 生成 `draft_config.json` 文件

**输出格式：**
```json
{
  "segments": [
    {"id": 1, "start": 0.0, "end": 2.5},
    {"id": 2, "start": 3.8, "end": 6.5},
    ...
  ]
}
```

**然后你只需：**
1. 打开 `draft_config.json`
2. 填写每个片段的正确文本
3. 微调时间戳（如需要）
4. 复制到 `src/app/page.tsx`

---

**问题？** 如果安装遇到问题，请告诉我具体的错误信息。
