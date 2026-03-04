#!/bin/bash

# 清理 shadowhub 视频目录重复文件（使用 wrangler）

set -e

echo "========================================"
echo "  shadowhub 视频目录清理"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# R2 桶名称
R2_BUCKET="engnovate-audio"

# 影子目录
SHADOWHUB_VIDEOS="shadowhub/videos/"
SHADOWHUB_YOUTUBE_VIDEOS="shadowhub/youtube_videos/"

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: wrangler 未安装"
    echo ""
    echo "请安装 wrangler:"
    echo "  npm install -g wrangler"
    echo ""
    exit 1
fi

# 步骤 1：扫描两个目录
echo -e "${YELLOW}步骤 1: 扫描目录${NC}"
echo "========================================"

echo "获取 shadowhub/videos/ 文件列表..."
wrangler r2 object list "$R2_BUCKET" --prefix="$SHADOWHUB_VIDEOS" > /tmp/shadowhub_videos.txt 2>&1 || true
videos_count=$(grep -c "^shadowhub/videos/" /tmp/shadowhub_videos.txt || echo "0")

echo "获取 shadowhub/youtube_videos/ 文件列表..."
wrangler r2 object list "$R2_BUCKET" --prefix="$SHADOWHUB_YOUTUBE_VIDEOS" > /tmp/shadowhub_youtube_videos.txt 2>&1 || true
youtube_count=$(grep -c "^shadowhub/youtube_videos/" /tmp/shadowhub_youtube_videos.txt || echo "0")

echo ""
echo "shadowhub/videos/: $videos_count 个文件"
echo "shadowhub/youtube_videos/: $youtube_count 个文件"
echo ""

# 显示文件
if [ "$videos_count" -gt 0 ]; then
    echo "shadowhub/videos/ 文件:"
    head -10 /tmp/shadowhub_videos.txt | grep "^shadowhub/videos/"
    if [ "$videos_count" -gt 10 ]; then
        echo "  ... 还有 $((videos_count - 10)) 个"
    fi
    echo ""
fi

if [ "$youtube_count" -gt 0 ]; then
    echo "shadowhub/youtube_videos/ 文件:"
    head -10 /tmp/shadowhub_youtube_videos.txt | grep "^shadowhub/youtube_videos/"
    if [ "$youtube_count" -gt 10 ]; then
        echo "  ... 还有 $((youtube_count - 10)) 个"
    fi
    echo ""
fi

# 步骤 2：查找重复文件
echo -e "${YELLOW}步骤 2: 查找重复文件${NC}"
echo "========================================"

# 提取文件名
grep "^shadowhub/videos/" /tmp/shadowhub_videos.txt 2>/dev/null | sed 's|^.*/||' > /tmp/videos_names.txt
grep "^shadowhub/youtube_videos/" /tmp/shadowhub_youtube_videos.txt 2>/dev/null | sed 's|^.*/||' > /tmp/youtube_names.txt

# 找出重复的文件名
duplicate_count=0
if [ -f /tmp/videos_names.txt ] && [ -f /tmp/youtube_names.txt ]; then
    duplicates=$(comm -12 /tmp/videos_names.txt /tmp/youtube_names.txt || true)
    duplicate_count=$(echo "$duplicates" | grep -c "." || echo "0")

    if [ "$duplicate_count" -gt 0 ]; then
        echo "发现 $duplicate_count 个重复文件:"
        echo "$duplicates" | head -10
        if [ "$duplicate_count" -gt 10 ]; then
            echo "  ... 还有 $((duplicate_count - 10)) 个"
        fi
    else
        echo "✅ 没有发现完全重复的文件"
    fi
fi

echo ""

# 步骤 3：确认处理
echo -e "${YELLOW}步骤 3: 执行清理和迁移${NC}"
echo "========================================"
echo ""
echo "处理策略:"
echo "1. 删除 youtube_videos/ 中与 videos/ 重复的文件"
echo "2. 将 youtube_videos/ 中剩余的文件移动到 videos/"
echo ""
read -p "是否继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 取消操作"
    exit 0
fi

# 执行删除和迁移
deleted_count=0
moved_count=0

# 处理重复文件（删除 youtube_videos/ 中的）
if [ "$duplicate_count" -gt 0 ]; then
    echo ""
    echo "删除重复文件..."
    echo "$duplicates" | while read -r filename; do
        if [ -n "$filename" ]; then
            echo "  🗑️  删除: shadowhub/youtube_videos/$filename"
            wrangler r2 object delete "$R2_BUCKET" "shadowhub/youtube_videos/$filename" > /dev/null 2>&1 || true
            deleted_count=$((deleted_count + 1))
        fi
    done
fi

# 移动剩余文件
echo ""
echo "迁移剩余文件..."
grep "^shadowhub/youtube_videos/" /tmp/shadowhub_youtube_videos.txt 2>/dev/null | while read -r line; do
    if [ -n "$line" ]; then
        filename=$(echo "$line" | sed 's|^.*/||')
        old_key="shadowhub/youtube_videos/$filename"
        new_key="shadowhub/videos/$filename"

        # 检查目标是否已存在
        if grep -q "^$new_key$" /tmp/shadowhub_videos.txt 2>/dev/null; then
            echo "  ⚠️  跳过: $filename (目标已存在)"
        else
            echo "  📦 移动: $filename"
            wrangler r2 object copy "$R2_BUCKET" "$old_key" "$R2_BUCKET" "$new_key" > /dev/null 2>&1 || true
            moved_count=$((moved_count + 1))
        fi

        # 删除源文件
        wrangler r2 object delete "$R2_BUCKET" "$old_key" > /dev/null 2>&1 || true
    fi
done

# 最终检查
echo ""
echo -e "${YELLOW}步骤 4: 验证结果${NC}"
echo "========================================"

wrangler r2 object list "$R2_BUCKET" --prefix="$SHADOWHUB_YOUTUBE_VIDEOS" > /tmp/youtube_final.txt 2>&1 || true
youtube_final=$(grep -c "^shadowhub/youtube_videos/" /tmp/youtube_final.txt || echo "0")

wrangler r2 object list "$R2_BUCKET" --prefix="$SHADOWHUB_VIDEOS" > /tmp/videos_final.txt 2>&1 || true
videos_final=$(grep -c "^shadowhub/videos/" /tmp/videos_final.txt || echo "0")

echo ""
echo -e "${GREEN}清理完成！${NC}"
echo ""
echo "统计:"
echo "  删除重复文件: $deleted_count"
echo "  移动文件: $moved_count"
echo ""
echo "最终状态:"
echo "  shadowhub/videos/: $videos_final 个文件"
echo "  shadowhub/youtube_videos/: $youtube_final 个文件"

# 清理临时文件
rm -f /tmp/shadowhub_videos.txt /tmp/shadowhub_youtube_videos.txt
rm -f /tmp/videos_names.txt /tmp/youtube_names.txt
rm -f /tmp/youtube_final.txt /tmp/videos_final.txt
