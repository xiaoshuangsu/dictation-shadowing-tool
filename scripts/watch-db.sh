#!/bin/bash

# Supabase 数据库连接监控脚本（15分钟间隔版）
#
# 功能：每 15 分钟探测一次数据库连接
# 成功时播放声音并弹出通知

echo "═════════════════════════════════════════"
echo "  Supabase 数据库连接监控（低频版）"
echo "═════════════════════════════════════════"
echo "🕐 启动时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "⏱️  探测间隔: 15 分钟（降低频率避免IP封锁）"
echo "📍 项目目录: $(pwd)"
echo ""
echo "✅ 监控已启动！按 Ctrl+C 停止"
echo "═════════════════════════════════════════"
echo ""

# macOS 语音提醒函数
announce_success() {
    echo ""
    echo "═════════════════════════════════════════"
    echo "  🎉🎉🎉 成功啦！数据库已恢复！🎉🎉🎉"
    echo "═════════════════════════════════════════"
    echo ""

    # macOS 语音播报（重复 3 次）
    for i in {1..3}; do
        say "Supabase database is back online! Success! Success!" &
        sleep 2
    done

    # macOS 系统通知
    if command -v osascript &> /dev/null; then
        osascript -e 'display notification "数据库连接已恢复！请立即解除硬编码！" with title "✅ Supabase 已恢复" sound name "Glass"'
    fi

    echo "🚀 请立即执行以下操作："
    echo "   1. 解除 api/topics 的硬编码"
    echo "   2. 恢复 Auth 配置"
    echo "   3. 重启开发服务器"
    echo ""
}

# 探测循环
while true; do
    echo "[$(date '+%H:%M:%S')] 🔍 正在探测..."

    # 运行探测脚本并捕获输出
    if npx tsx scripts/ping-db.ts 2>&1 | grep -q "SUCCESS"; then
        # 成功！
        echo "[$(date '+%H:%M:%S')] ✅ 探测成功！"
        announce_success
        break
    else
        # 失败
        echo "[$(date '+%H:%M:%S')] ❌ 仍然超时，15 分钟后重试..."
    fi

    # 等待 15 分钟（900 秒）
    for i in {900..1}; do
        # 每 5 分钟显示一次倒计时
        if [ $((i % 300)) -eq 0 ]; then
            echo "[$(date '+%H:%M:%S')] ⏳ 下次探测: ${i} 秒后 ($((i/60)) 分钟)"
        fi
        sleep 1
    done
done

echo ""
echo "═════════════════════════════════════════"
echo "  监控已结束"
echo "═════════════════════════════════════════"
