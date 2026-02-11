#!/bin/bash
# 音频切分工具 - 一键安装脚本

echo "========================================="
echo "🎙️  音频切分工具 - 安装脚本"
echo "========================================="
echo ""

# 检查 ffmpeg
echo "🔍 检查 ffmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg 已安装"
    ffmpeg -version | head -1
else
    echo "❌ ffmpeg 未安装"
    echo ""
    echo "请先安装 ffmpeg："
    echo ""
    echo "方法 1 - 使用 Homebrew（推荐）:"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  然后运行: brew install ffmpeg"
    echo ""
    echo "方法 2 - 手动下载:"
    echo "  访问 https://ffmpeg.org/download.html"
    echo "  下载 macOS 版本并安装"
    echo ""
    exit 1
fi

# 检查 pydub
echo ""
echo "🔍 检查 pydub..."
if python3 -c "import pydub" 2>/dev/null; then
    echo "✅ pydub 已安装"
else
    echo "📦 安装 pydub..."
    pip3 install pydub
fi

echo ""
echo "✅ 所有依赖已就绪！"
echo ""
echo "现在可以运行:"
echo "  python3 vad_detect_silence.py"
echo ""
