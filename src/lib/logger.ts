/**
 * 日志捕捉器
 * 用于收集用户测试期间的错误和问题
 */

// 日志级别
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// 日志条目
interface LogEntry {
  timestamp: string
  level: LogLevel
  category: string
  message: string
  data?: any
  url?: string
  userAgent?: string
  userId?: string
}

// 日志配置
interface LoggerConfig {
  enableConsole?: boolean        // 是否输出到控制台 (默认: true)
  enableStorage?: boolean         // 是否保存到 localStorage (默认: true)
  maxStorageEntries?: number      // 最大存储条目数 (默认: 500)
  autoFlush?: boolean             // 是否自动上报到服务器 (默认: false)
  flushUrl?: string               // 上报地址
}

class Logger {
  private config: LoggerConfig = {
    enableConsole: true,
    enableStorage: true,
    maxStorageEntries: 500,
    autoFlush: false,
  }

  private logs: LogEntry[] = []
  private sessionId: string

  constructor(config?: LoggerConfig) {
    this.config = { ...this.config, ...config }
    this.sessionId = this.generateSessionId()
    // Only initialize client-side features on browser
    if (typeof window !== 'undefined') {
      this.loadStoredLogs()
      this.setupGlobalErrorHandlers()
    }
  }

  // 生成会话ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  // 从 localStorage 加载存储的日志
  private loadStoredLogs() {
    if (typeof window === 'undefined' || !this.config.enableStorage) return

    try {
      const stored = localStorage.getItem('app_logs')
      if (stored) {
        const parsed = JSON.parse(stored)
        this.logs = Array.isArray(parsed) ? parsed : []
        // 限制日志数量
        const maxEntries = this.config.maxStorageEntries ?? 500
        if (this.logs.length > maxEntries) {
          this.logs = this.logs.slice(-maxEntries)
        }
      }
    } catch (error) {
      console.error('Failed to load stored logs:', error)
      this.logs = []
    }
  }

  // 保存日志到 localStorage
  private saveToStorage() {
    if (typeof window === 'undefined' || !this.config.enableStorage) return

    try {
      // 限制日志数量
      const maxEntries = this.config.maxStorageEntries ?? 500
      const limitedLogs = this.logs.slice(-maxEntries)
      localStorage.setItem('app_logs', JSON.stringify(limitedLogs))
    } catch (error) {
      console.error('Failed to save logs to storage:', error)
    }
  }

  // 设置全局错误处理器
  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return
    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      const errorData = {
        message: event.message || 'Unknown error',
        filename: event.filename || '',
        line: event.lineno || 0,
        col: event.colno || 0,
      }
      this.error('Unhandled Error', JSON.stringify(errorData))
    })

    // 捕获未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      const reasonStr = String(event.reason || 'Unknown')
      this.error('Unhandled Promise Rejection', reasonStr)
    })

    // 捕获资源加载错误
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement
        const src = (target as any).src || (target as any).href || 'unknown'
        this.error('Resource Load Error', `${target.tagName}: ${src}`)
      }
    }, true)
  }

  // 添加日志
  private addLog(level: LogLevel, category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }

    this.logs.push(entry)

    // 输出到控制台
    if (this.config.enableConsole) {
      this.logToConsole(entry)
    }

    // 保存到存储
    this.saveToStorage()

    // 自动上报
    if (this.config.autoFlush && this.config.flushUrl) {
      this.flushToServer()
    }
  }

  // 输出到控制台
  private logToConsole(entry: LogEntry) {
    const logMethod = {
      [LogLevel.DEBUG]: console.log,
      [LogLevel.INFO]: console.info,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
    }[entry.level]

    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const prefix = `[${timestamp}] [${entry.level}] [${entry.category}]`

    if (entry.data) {
      logMethod(`${prefix}:`, entry.message, entry.data)
    } else {
      logMethod(`${prefix}:`, entry.message)
    }
  }

  // 日志级别方法
  debug(category: string, message: string, data?: any) {
    this.addLog(LogLevel.DEBUG, category, message, data)
  }

  info(category: string, message: string, data?: any) {
    this.addLog(LogLevel.INFO, category, message, data)
  }

  warn(category: string, message: string, data?: any) {
    this.addLog(LogLevel.WARN, category, message, data)
  }

  error(category: string, message: string, data?: any) {
    this.addLog(LogLevel.ERROR, category, message, data)
  }

  // 获取所有日志
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  // 清空日志
  clearLogs() {
    this.logs = []
    if (this.config.enableStorage && typeof window !== 'undefined') {
      localStorage.removeItem('app_logs')
    }
    this.info('Logger', 'Logs cleared')
  }

  // 导出日志为 JSON
  exportLogs(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      totalLogs: this.logs.length,
      logs: this.logs,
    }

    return JSON.stringify(exportData, null, 2)
  }

  // 下载日志文件
  downloadLogs(filename?: string) {
    if (typeof window === 'undefined') return

    const data = this.exportLogs()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename || `logs_${this.sessionId}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

    this.info('Logger', `Logs downloaded: ${link.download}`)
  }

  // 上报到服务器
  async flushToServer(): Promise<boolean> {
    if (!this.config.flushUrl) {
      console.warn('No flush URL configured')
      return false
    }

    try {
      const response = await fetch(this.config.flushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          logs: this.logs,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 清空已上报的日志
      this.logs = []
      this.saveToStorage()

      this.info('Logger', 'Logs flushed to server successfully')
      return true
    } catch (error) {
      this.error('Logger', 'Failed to flush logs to server', { error })
      return false
    }
  }

  // 获取统计信息
  getStats() {
    const stats = {
      sessionId: this.sessionId,
      totalLogs: this.logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      timeRange: {
        first: this.logs[0]?.timestamp,
        last: this.logs[this.logs.length - 1]?.timestamp,
      },
    }

    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1
    }

    return stats
  }
}

// 延迟初始化日志实例（仅在客户端）
let defaultLoggerInstance: Logger | null = null

function getLogger(): Logger {
  if (typeof window === 'undefined') {
    // Server-side: return a no-op logger
    return new Logger({ enableConsole: false, enableStorage: false })
  }
  if (!defaultLoggerInstance) {
    defaultLoggerInstance = new Logger()
  }
  return defaultLoggerInstance
}

// 导出 logger getter
export const logger = new Proxy({} as Logger, {
  get(target, prop) {
    const loggerInstance = getLogger()
    return loggerInstance[prop as keyof Logger]
  }
}) satisfies Logger

// 导出工厂函数
export function createLogger(config?: LoggerConfig): Logger {
  if (typeof window === 'undefined') {
    return new Logger({ enableConsole: false, enableStorage: false })
  }
  return new Logger(config)
}
