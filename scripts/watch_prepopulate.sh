#!/bin/bash
# 自动监控并重启预生成脚本

LOG_FILE="/tmp/dict_prepopulate.log"
PID_FILE="/tmp/dict_prepopulate.pid"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/final_prepopulate_all.py"

check_and_restart() {
    if ! ps -p $(cat $PID_FILE 2>/dev/null) > /dev/null 2>&1; then
        echo "$(date): 脚本未运行，重新启动..." >> $LOG_FILE
        nohup $SCRIPT_DIR/.venv/bin/python $PYTHON_SCRIPT --yes --background >> $LOG_FILE 2>&1 &
        echo $! > $PID_FILE
        echo "$(date): 已启动，PID: $!" >> $LOG_FILE
    fi
}

# 首次启动
if [ ! -f $PID_FILE ] || ! ps -p $(cat $PID_FILE 2>/dev/null) > /dev/null 2>&1; then
    nohup $SCRIPT_DIR/.venv/bin/python $PYTHON_SCRIPT --yes --background >> $LOG_FILE 2>&1 &
    echo $! > $PID_FILE
    echo "$(date): 初始启动，PID: $!" >> $LOG_FILE
fi

echo "监控脚本已启动，PID: $$"
echo "日志文件: $LOG_FILE"
echo "停止监控: kill $$"

# 每 60 秒检查一次
while true; do
    sleep 60
    check_and_restart
done
