'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

export function DebugLogger() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all')

  // 刷新日志
  const refreshLogs = () => {
    setLogs(logger.getLogs())
  }

  // 每3秒自动刷新（如果打开）
  useEffect(() => {
    if (isOpen) {
      refreshLogs()
      const interval = setInterval(refreshLogs, 3000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  // 下载日志
  const downloadLogs = () => {
    logger.downloadLogs()
  }

  // 清空日志
  const clearLogs = () => {
    if (confirm('确定要清空所有日志吗？')) {
      logger.clearLogs()
      refreshLogs()
    }
  }

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true
    return log.level === filter.toUpperCase()
  })

  // 获取统计信息
  const stats = logger.getStats()
  const errorCount = stats.byLevel.ERROR || 0
  const warnCount = stats.byLevel.WARN || 0

  // 自动打开如果有错误
  useEffect(() => {
    if (errorCount > 0 && !isOpen) {
      setIsOpen(true)
    }
  }, [errorCount, isOpen])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 shadow-lg transition-colors"
        title="查看日志"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 3.182-3.47V6.618c0-1.805-.87-3.327-2.353-4.036C14.975 7.47 12.96 5.253 12 3.463c-.973 1.79-4.88 3.176-6.667 3.028C2.212 9.954 1.27 12.09 2.696 14.535c.23 1.26.425 2.548.72 3.866a9.99 9.99 0 003.63 1.557 10.345 10.345z" />
        </svg>
        {(errorCount > 0 || warnCount > 0) && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-16 right-4 z-50 w-[400px] max-h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">🔍 日志查看器</h3>
          <span className="text-xs text-gray-500">
            {stats.totalLogs} 条日志
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* 统计信息 */}
      <div className="px-4 py-2 bg-gray-50 border-b text-xs">
        <div className="flex gap-4">
          <span>错误: <strong className="text-red-600">{stats.byLevel.ERROR || 0}</strong></span>
          <span>警告: <strong className="text-yellow-600">{stats.byLevel.WARN || 0}</strong></span>
          <span>信息: <strong className="text-blue-600">{stats.byLevel.INFO || 0}</strong></span>
        </div>
        <div className="text-gray-500 mt-1">
          会话: {stats.sessionId?.split('_')[1] || 'N/A'}
        </div>
      </div>

      {/* 过滤器 */}
      <div className="px-4 py-2 border-b flex gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-2 py-1 text-sm border rounded-md"
        >
          <option value="all">全部</option>
          <option value="error">仅错误</option>
          <option value="warn">仅警告</option>
          <option value="info">仅信息</option>
        </select>
        <button
          onClick={refreshLogs}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          刷新
        </button>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">暂无日志</p>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`mb-2 p-2 rounded ${
                log.level === 'ERROR' ? 'bg-red-50 border border-red-200' :
                log.level === 'WARN' ? 'bg-yellow-50 border border-yellow-200' :
                log.level === 'INFO' ? 'bg-blue-50 border border-blue-200' :
                'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <span className="text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`text-[10px] px-1 rounded ${
                  log.level === 'ERROR' ? 'bg-red-200 text-red-800' :
                  log.level === 'WARN' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {log.level}
                </span>
                <span className="text-[10px] text-gray-400">
                  {log.category}
                </span>
              </div>
              <div className="text-gray-700">{log.message}</div>
              {log.data && (
                <pre className="mt-1 text-[10px] text-gray-500 overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      {/* 操作按钮 */}
      <div className="px-4 py-3 border-t flex gap-2">
        <button
          onClick={downloadLogs}
          className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          📥 下载日志
        </button>
        <button
          onClick={clearLogs}
          className="flex-1 px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          🗑️ 清空
        </button>
      </div>
    </div>
  )
}
