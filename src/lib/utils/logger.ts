/**
 * Logger - 统一的日志管理工具
 *
 * 功能：
 * - 开发环境：输出带前缀的日志
 * - 生产环境：完全禁用 console.log（提升性能），仅保留 error
 * - 支持多种日志级别：log, info, warn, error, debug
 *
 * 使用方式：
 * - logger.log('普通日志')
 * - logger.info('信息日志', data)
 * - logger.warn('警告日志')
 * - logger.error('错误日志', error)
 * - logger.debug('调试日志', data) // 仅开发环境
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    return `${prefix} ${message}`
  }

  /** 普通日志（仅开发环境） */
  log(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.log(this.formatMessage('log', message), ...args)
    }
  }

  /** 信息日志（仅开发环境） */
  info(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.info(this.formatMessage('info', message), ...args)
    }
  }

  /** 警告日志（仅开发环境） */
  warn(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.warn(this.formatMessage('warn', message), ...args)
    }
  }

  /** 错误日志（生产环境也会输出） */
  error(message: string, ...args: any[]): void {
    // 错误日志始终输出（包括生产环境）
    console.error(this.formatMessage('error', message), ...args)
  }

  /** 调试日志（仅开发环境） */
  debug(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.log(this.formatMessage('debug', message), ...args)
    }
  }

  /** 性能日志（仅开发环境） */
  perf(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.log(`⚡ ${message}`, ...args)
    }
  }
}

const logger = new Logger()

export default logger
