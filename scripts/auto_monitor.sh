#!/bin/bash
# 自动监控脚本 - 每 2 小时执行一次
# 使用方法: nohup bash scripts/auto_monitor.sh > monitoring.log 2>&1 &

MONITOR_INTERVAL=7200  # 2 小时（秒）
LOG_FILE="monitoring_log.txt"
REPORT_FILE="daily_report.txt"

echo "================================================================================" | tee -a "$LOG_FILE"
echo "🤖 自动监控系统启动 - $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "================================================================================" | tee -a "$LOG_FILE"
echo "监控间隔: $MONITOR_INTERVAL 秒 (2 小时)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 监控循环
while true; do
    echo "--------------------------------------------------------------------------------" | tee -a "$LOG_FILE"
    echo "📊 监控周期 #$(($(date +%s) / MONITOR_INTERVAL)) - $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
    echo "--------------------------------------------------------------------------------" | tee -a "$LOG_FILE"

    # 1. 检查进程状态
    echo -e "\n【1️⃣ 进程状态】" | tee -a "$LOG_FILE"
    if ps aux | grep -v grep | grep "reprocess_translation_v3_production.py" > /dev/null; then
        echo "✅ 翻译进程运行中" | tee -a "$LOG_FILE"
        ps aux | grep -v grep | grep "reprocess_translation_v3_production.py" | awk '{printf "  PID: %s | CPU: %s%% | MEM: %s%%\n", $2, $3, $4}' | tee -a "$LOG_FILE"
    else
        echo "⚠️  翻译进程未运行！" | tee -a "$LOG_FILE"
        echo "  请检查: ps aux | grep reprocess_translation" | tee -a "$LOG_FILE"
    fi

    # 2. 检查最新进度
    echo -e "\n【2️⃣ 最新进度】" | tee -a "$LOG_FILE"
    tail -3 production_v4_clean.log | grep -E "进度|成功|失败" | tail -1 | tee -a "$LOG_FILE"

    # 3. 检查拦截日志
    echo -e "\n【3️⃣ 拦截统计】" | tee -a "$LOG_FILE"
    intercept_count=$(grep -c "🚫 拦截翻译" scripts/translation_batch.log 2>/dev/null || echo "0")
    echo "  累计拦截: $intercept_count 次" | tee -a "$LOG_FILE"

    if [ "$intercept_count" -gt 0 ]; then
        echo -e "\n  最近 5 次拦截:" | tee -a "$LOG_FILE"
        grep "🚫 拦截翻译" scripts/translation_batch.log | tail -5 | tee -a "$LOG_FILE"
    fi

    # 4. 抽样检查翻译质量（Python 脚本）
    echo -e "\n【4️⃣ 翻译质量抽样】" | tee -a "$LOG_FILE"
    python3 << 'PYEOF' | tee -a "$LOG_FILE"
from dotenv import load_dotenv
from supabase import create_client
import os
import random
from pathlib import Path

env_path = Path('.env.local')
load_dotenv(env_path)

supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# 获取最近的翻译
response = supabase.table('materials') \
    .select('id, slug, transcript') \
    .not_('transcript', 'is', None) \
    .limit(20) \
    .execute()

samples = []
for material in response.data:
    transcript = material.get('transcript', [])
    for sentence in transcript:
        translation = sentence.get('translation', {})

        # 检查孟加拉语和印地语
        for lang in ['bn', 'hi']:
            if lang in translation and translation[lang] and translation[lang] != '[TODO_RETRY]':
                text = translation[lang]
                # 简单检查是否有问题
                has_problem = (
                    '<' in text or '>' in text or
                    'instruction' in text.lower() or
                    'critical' in text.lower() or
                    '翻译' in text or
                    'শব্দ পুনরাবৃত্তি' in text
                )

                status = "⚠️" if has_problem else "✅"
                samples.append(f"  {status} {lang}: {text[:60]}...")

                if len(samples) >= 3:
                    break
        if len(samples) >= 3:
            break

if samples:
    for sample in samples:
        print(sample)
else:
    print("  未找到新的翻译样本")
PYEOF

    # 5. 计算成功率
    echo -e "\n【5️⃣ 成功率统计】" | tee -a "$LOG_FILE"
    latest_stats=$(tail -20 production_v4_clean.log | grep "进度:" | tail -1)
    if [ -n "$latest_stats" ]; then
        echo "  $latest_stats" | tee -a "$LOG_FILE"

        # 提取成功和失败数量
        success=$(echo "$latest_stats" | grep -oP '成功: \K\d+' || echo "0")
        total=$((success + $(echo "$latest_stats" | grep -oP '失败: \K\d+' || echo "0")))

        if [ "$total" -gt 0 ]; then
            rate=$((success * 100 / total))
            echo "  成功率: $rate%" | tee -a "$LOG_FILE"

            # 警告检查
            if [ "$rate" -lt 50 ]; then
                echo "  ⚠️  警告: 成功率低于 50%！" | tee -a "$LOG_FILE"
            fi
        fi
    fi

    echo "" | tee -a "$LOG_FILE"
    echo "✅ 本轮监控完成，等待下一轮..." | tee -a "$LOG_FILE"
    echo "下一轮时间: $(date -d '+$MONITOR_INTERVAL seconds' '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    # 等待下一轮
    sleep "$MONITOR_INTERVAL"
done
