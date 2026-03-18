# YouTube 字幕抓取 - PO Token 解决方案

## 📋 问题诊断

### ✅ 已确认的事实

1. **视频有自动生成字幕** - 您在 YouTube 上能看到
2. **yt-dlp 能检测到字幕** - 输出显示 `Subtitles for these languages are missing: ... en ...`
3. **需要 PO Token** - YouTube 要求 PO Token 才能访问这些字幕

## 🔑 解决方案：使用 PO Token

### 步骤 1: 安装浏览器扩展

在 Chrome 或 Edge 浏览器中安装：

**扩展名称**: `Get cookies.txt LOCALLY`

**安装方法**:
1. 访问 Chrome 网上应用店
2. 搜索 "Get cookies.txt LOCALLY"
3. 点击"添加到 Chrome"

### 步骤 2: 获取 Cookies

1. **访问 YouTube 视频页面**
   ```
   https://www.youtube.com/watch?v=pdRWeK9f02w
   ```

2. **点击扩展图标**（浏览器右上角）

3. **点击 "Current Tab"** 导出按钮

4. **保存为 `cookies.txt`**（保存到任何位置，如桌面）

### 步骤 3: 提取 PO Token

```bash
# 进入项目目录
cd /Users/a/dictation

# 运行 PO Token 提取脚本
source scripts/.venv/bin/activate
python3 scripts/get_potoken.py ~/Desktop/cookies.txt
```

**输出示例**:
```
✅ 找到 PO Token: po_token=android.gvs+CAA...
```

### 步骤 4: 使用 PO Token 抓取字幕

```bash
# 方法 1: 使用提取的 PO Token
python3 scripts/fetch_youtube_auto_subs.py \
  https://youtu.be/pdRWeK9f02w \
  --extractor-args 'youtube:po_token=YOUR_PO_TOKEN'

# 方法 2: 直接在命令中使用 yt-dlp
source scripts/.venv/bin/activate

# 将 YOUR_PO_TOKEN 替换为实际 token
yt-dlp \
  --write-auto-subs \
  --sub-lang en \
  --sub-format vtt \
  --skip-download \
  --extractor-args 'youtube:po_token=YOUR_PO_TOKEN' \
  --output subtitle.vtt \
  https://youtu.be/pdRWeK9f02w
```

---

## 📝 快速测试（完整流程）

```bash
# 1. 获取 PO Token
python3 scripts/get_potoken.py ~/Desktop/cookies.txt

# 2. 抓取字幕（使用输出的 PO Token）
python3 scripts/fetch_youtube_auto_subs.py \
  https://youtu.be/pdRWeK9f02w \
  --extractor-args 'youtube:po_token=android.gvs+CAA...'

# 3. 访问测试页面
# http://localhost:3000/topics/daily-life/ted-talk-how-to-be-happier
```

---

## 🔍 验证 PO Token 是否有效

### 检查命令输出

如果 PO Token 有效，您应该看到：

```
📥 正在下载自动生成字幕...
🔑 使用 PO Token: android.gvs+CAA...

✅ 成功下载! 文件大小: 15234 bytes
📄 文件预览:
  WEBVTT
  Kind: captions
  Language: en
  00:00:00.500 --> 00:00:03.000
  Text: This is the first sentence.
```

### 如果 PO Token 无效

```
❌ 命令失败，返回码: 1
[ERR] HTTP Error 403: Forbidden
```

**解决方案**:
- 重新获取 cookies（可能已过期）
- 确保在访问 YouTube 视频页面时导出 cookies
- 尝试刷新页面后再导出

---

## 🚀 自动化方案（可选）

### 方案 A: 浏览器自动化

使用 Selenium 或 Playwright 自动获取 PO Token：

```python
# scripts/auto_get_potoken.py
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

def get_potoken_auto(video_url: str) -> str:
    """使用 Selenium 自动获取 PO Token"""
    options = Options()
    options.add_argument('--headless')  # 无头模式

    driver = webdriver.Chrome(options=options)

    try:
        driver.get(video_url)
        time.sleep(5)  # 等待页面加载

        # 获取 cookies
        cookies = driver.get_cookies()

        # 查找 PO token
        for cookie in cookies:
            if cookie['name'] == 'PO_TOKEN':
                return cookie['value']

        return None
    finally:
        driver.quit()

# 使用
potoken = get_potoken_auto("https://www.youtube.com/watch?v=pdRWeK9f02w")
print(f"PO Token: {potoken}")
```

### 方案 B: YouTube Data API v3

使用官方 API（需要 API Key）：

```python
# scripts/fetch_using_youtube_api.py
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def get_captions_with_api(video_id: str, api_key: str):
    """使用 YouTube Data API v3 获取字幕"""
    youtube = build('youtube', 'v3', developerKey=api_key)

    try:
        # 获取字幕列表
        response = youtube.captions().list(
            part='snippet',
            videoId=video_id
        ).execute()

        # 下载字幕
        # ...

    except HttpError as e:
        print(f"API Error: {e}")
```

---

## 🎯 推荐工作流程

### 对于个人使用

1. **手动获取 PO Token**（每 1-2 天更新一次）
2. **运行抓取脚本**
3. **验证字幕质量**

### 对于批量导入

1. **获取 PO Token**
2. **批量抓取**（注意 YouTube API 限制）
3. **存储到数据库**

```bash
# 批量抓取示例
while read url; do
  python3 scripts/fetch_youtube_auto_subs.py "$url" \
    --extractor-args 'youtube:po_token=YOUR_PO_TOKEN'
  sleep 10  # 避免请求过快
done < youtube_urls.txt
```

---

## 📚 相关文档

- [yt-dlp PO Token 指南](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [Get cookies.txt LOCALLY 扩展](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/ccnckbpaacehhfdljonibcbfblmo)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)

---

## ✅ 检查清单

使用 PO Token 前：
- [ ] 已安装浏览器扩展
- [ ] 已访问 YouTube 视频页面
- [ ] 已导出 cookies.txt
- [ ] 已提取 PO Token

使用 PO Token 时：
- [ ] 命令中包含 `--extractor-args 'youtube:po_token=XXX'`
- [ ] 替换 XXX 为实际 token
- [ ] 看到 "文件大小: XXX bytes" 输出

---

**创建日期**: 2025-03-17
**版本**: 2.0.0 - PO Token 支持
