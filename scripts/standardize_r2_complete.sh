#!/bin/bash

# R2 存储规范化完整流程
# 按顺序执行所有步骤

set -e  # 遇到错误立即退出

echo "========================================"
echo "  R2 存储规范化完整流程"
echo "========================================"
echo ""

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 步骤 0：清理 shadowhub 目录
echo -e "${BLUE}步骤 0: 清理 shadowhub 视频目录${NC}"
echo "========================================"
echo "检查 shadowhub/videos/ 和 shadowhub/youtube_videos/"
echo ""
read -p "是否清理 shadowhub 重复文件？(yes/no): " confirm
if [ "$confirm" = "yes" ]; then
    python3 scripts/cleanup_shadowhub_videos.py
else
    echo "跳过步骤 0"
fi
echo ""

# 步骤 1：检查 R2 文件
echo -e "${YELLOW}步骤 1: 检查 R2 存储桶文件${NC}"
echo "========================================"
python3 scripts/check_r2_files.py
echo ""

# 步骤 2：清理和迁移
echo -e "${YELLOW}步骤 2: 清理和迁移文件${NC}"
echo "========================================"
echo "将错误放置的文件移动到正确的存储桶："
echo "  - R2 桶中的视频 → VIDEOS 桶"
echo "  - VIDEOS 桶中的音频/图片 → R2 桶"
echo ""
read -p "是否继续清理和迁移？(yes/no): " confirm
if [ "$confirm" = "yes" ]; then
    python3 scripts/cleanup_and_migrate_r2.py
else
    echo "跳过步骤 2"
fi
echo ""

# 步骤 3：更新 Cloudflare Worker
echo -e "${YELLOW}步骤 3: 更新 Cloudflare Worker${NC}"
echo "========================================"
echo "请手动完成以下步骤："
echo ""
echo "1. 登录 Cloudflare Dashboard: https://dash.cloudflare.com/"
echo "2. 进入 Workers & Pages → 找到 r2-proxy Worker"
echo "3. 确认存储桶绑定："
echo "   - Variable name: R2, Bucket name: engnovate-audio"
echo "   - Variable name: VIDEOS, Bucket name: engnovate-videos"
echo "4. 编辑 Worker 代码，复制 workers/r2-router-smart.js 的内容"
echo "5. 部署 Worker"
echo ""
read -p "完成后按 Enter 继续..."
echo ""

# 步骤 4：测试 Worker
echo -e "${YELLOW}步骤 4: 测试 Worker 路由${NC}"
echo "========================================"
echo "测试 URLs:"
echo ""
echo "  音频: https://r2-proxy.suxiaoshuang2020.workers.dev/audio/Canada_Provinces_and_Territories.mp3"
echo "  封面: https://r2-proxy.suxiaoshuang2020.workers.dev/thumbnails/Canada_Provinces_and_Territories.jpg"
echo "  视频: https://r2-proxy.suxiaoshuang2020.workers.dev/videos/empty-your-mind.mp4"
echo ""
read -p "请手动测试以上 URLs，确认返回 200 后按 Enter 继续..."
echo ""

# 步骤 5：修复 Supabase 路径
echo -e "${YELLOW}步骤 5: 修复 Supabase 数据库路径${NC}"
echo "========================================"
python3 scripts/fix_supabase_r2_paths.py
echo ""

# 步骤 6：处理 shadowhub 视频（如果需要迁移到 VIDEOS 桶）
echo -e "${YELLOW}步骤 6: shadowhub 视频迁移${NC}"
echo "========================================"
echo "shadowhub/videos/ 中的视频可以："
echo "  A. 保留在 R2 桶的 shadowhub/videos/（当前状态）"
echo "  B. 迁移到 VIDEOS 桶的 videos/（统一管理）"
echo ""
read -p "是否将 shadowhub 视频迁移到 VIDEOS 桶？(yes/no): " migrate_shadowhub
if [ "$migrate_shadowhub" = "yes" ]; then
    echo "请创建迁移脚本，或手动完成迁移"
    echo "参考: 使用 boto3 将文件从 R2:shadowhub/videos/ 复制到 VIDEOS:videos/"
else
    echo "跳过步骤 6，shadowhub 视频保留在 R2 桶"
fi
echo ""

# 完成
echo -e "${GREEN}========================================"
echo "  完成！"
echo "========================================${NC}"
echo ""
echo "下一步:"
echo "1. 重新构建网站: npm run build"
echo "2. 测试素材页面和练习页面"
echo "3. 确认移动端和 PC 端都能正常访问"
echo ""
