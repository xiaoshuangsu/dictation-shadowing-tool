#!/bin/bash

# R2 简化方案 - 一键执行脚本

set -e

echo "========================================"
echo "  R2 存储简化方案"
echo "========================================"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 从 .env.local 读取 R2_ACCOUNT_ID
if [ -f ".env.local" ]; then
    R2_ACCOUNT_ID=$(grep "NEXT_PUBLIC_R2_ACCOUNT_ID" .env.local | cut -d'=' -f2)
    echo "✅ 从 .env.local 读取到 R2_ACCOUNT_ID: $R2_ACCOUNT_ID"
else
    echo "❌ 错误: .env.local 文件不存在"
    exit 1
fi

# R2 配置
R2_BUCKET="engnovate-audio"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo ""
echo "简化方案目标:"
echo "  1. 统一使用 R2 bucket（删除 VIDEOS bucket 绑定）"
echo "  2. 迁移 youtube_videos/ 到 shadowhub/videos/"
echo "  3. 更新 Worker 代码"
echo "  4. 更新数据库路径"
echo ""

# ========================================
# 步骤 1：迁移文件
# ========================================
echo -e "${YELLOW}步骤 1: 迁移 youtube_videos/ 到 shadowhub/videos/${NC}"
echo "========================================"
echo ""
echo "使用 AWS CLI 批量移动文件..."
echo ""
echo "如果还没有安装 AWS CLI，请先安装:"
echo "  brew install awscli"
echo ""
echo "如果还没有配置 AWS CLI，请先配置:"
echo "  aws configure --profile r2"
echo ""
read -p "准备好了吗？(按 Enter 继续，或 Ctrl+C 取消)"

# 执行迁移
echo ""
echo "执行迁移命令:"
echo ""
echo "aws s3 mv s3://${R2_BUCKET}/shadowhub/youtube_videos/ \\"
echo "  s3://${R2_BUCKET}/shadowhub/videos/ \\"
echo "  --recursive \\"
echo "  --endpoint-url ${ENDPOINT} \\"
echo "  --profile r2"
echo ""

aws s3 mv s3://${R2_BUCKET}/shadowhub/youtube_videos/ s3://${R2_BUCKET}/shadowhub/videos/ \
  --recursive \
  --endpoint-url ${ENDPOINT} \
  --profile r2

echo ""
echo -e "${GREEN}✅ 迁移完成！${NC}"
echo ""

# ========================================
# 步骤 2：验证迁移
# ========================================
echo -e "${YELLOW}步骤 2: 验证迁移${NC}"
echo "========================================"
echo ""

echo "检查 youtube_videos/ 是否已清空..."
youtube_count=$(aws s3 ls s3://${R2_BUCKET}/shadowhub/youtube_videos/ \
  --endpoint-url ${ENDPOINT} \
  --profile r2 2>/dev/null | wc -l || echo "0")

echo "youtube_videos/ 文件数: $youtube_count"
echo ""

if [ "$youtube_count" -eq 0 ]; then
    echo -e "${GREEN}✅ youtube_videos/ 已清空${NC}"
else
    echo -e "${YELLOW}⚠️  youtube_videos/ 还有 $youtube_count 个文件${NC}"
fi

echo ""
echo "检查 shadowhub/videos/ 的文件..."
echo "aws s3 ls s3://${R2_BUCKET}/shadowhub/videos/ \\"
echo "  --endpoint-url ${ENDPOINT} \\"
echo "  --profile r2"
echo ""

aws s3 ls s3://${R2_BUCKET}/shadowhub/videos/ \
  --endpoint-url ${ENDPOINT} \
  --profile r2

echo ""

# ========================================
# 步骤 3-5：手动操作
# ========================================
echo -e "${YELLOW}下一步：${NC}"
echo "========================================"
echo ""
echo "3. 更新 Cloudflare Worker:"
echo "   - 登录 https://dash.cloudflare.com/"
echo "   - Workers & Pages → r2-proxy → Settings → Bindings"
echo "   - 删除 VIDEOS 存储桶绑定"
echo "   - Edit code → 复制 workers/r2-router-simplified.js"
echo "   - Deploy"
echo ""
echo "4. 验证 Worker:"
echo "   curl -I \"https://r2-proxy.suxiaoshuang2020.workers.dev/videos/empty-your-mind.mp4\""
echo ""
echo "5. 更新数据库路径:"
echo "   python3 scripts/normalize_supabase_paths.py"
echo ""

echo -e "${GREEN}========================================"
echo "  完成！"
echo "========================================${NC}"
