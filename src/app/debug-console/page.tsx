'use client'

import { useEffect, useState, useRef } from 'react'

export default function DebugConsolePage() {
  const [logs, setLogs] = useState<string[]>(['📱 调试监控已启动...'])

  useEffect(() => {
    const capturedLogs: string[] = ['📱 调试监控已启动...']

    // 拦截 console.log
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      capturedLogs.push(`📝 LOG: ${msg}`)
      setLogs([...capturedLogs])
      originalLog.apply(console, args)
    }

    console.error = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      capturedLogs.push(`❌ ERROR: ${msg}`)
      setLogs([...capturedLogs])
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      capturedLogs.push(`⚠️ WARN: ${msg}`)
      setLogs([...capturedLogs])
      originalWarn.apply(console, args)
    }

    // 拦截所有 fetch 请求
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const url = args[0] as string
      capturedLogs.push(`📡 Fetch: ${url}`)
      setLogs([...capturedLogs])

      try {
        const response = await originalFetch.apply(window, args)
        if (!response.ok) {
          capturedLogs.push(`❌ Fetch 失败: ${url} - ${response.status}`)
          setLogs([...capturedLogs])
        }
        return response
      } catch (error: any) {
        capturedLogs.push(`❌ Fetch 错误: ${url} - ${error?.message || error}`)
        setLogs([...capturedLogs])
        throw error
      }
    }

    // 监听资源加载错误
    window.addEventListener('error', (e) => {
      const target = e.target as HTMLElement & { src?: string; href?: string }
      const src = target.src || target.href
      if (src) {
        capturedLogs.push(`❌ 资源加载失败: ${src}`)
        setLogs([...capturedLogs])
      }
    }, true)

    // 5秒后提示
    setTimeout(() => {
      capturedLogs.push('💡 提示: 请点击"去练习页"选择一个素材，观察日志变化')
      setLogs([...capturedLogs])
    }, 2000)

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
      window.fetch = originalFetch
    }
  }, [])

  // 清空日志
  const clearLogs = () => {
    setLogs(['📱 日志已清空'])
  }

  return (
    <div style={{ padding: '20px', fontSize: '14px', fontFamily: 'monospace', maxWidth: '100vw' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '10px' }}>🐛 调试控制台</h1>
      <p style={{ color: '#666', fontSize: '12px', marginBottom: '15px' }}>
        捕获所有 console.log/error/warn 和网络请求
      </p>

      <div style={{
        background: '#1e1e1e',
        color: '#d4d4d4',
        padding: '15px',
        borderRadius: '8px',
        minHeight: '300px',
        maxHeight: '60vh',
        overflow: 'auto',
        fontSize: '11px',
        lineHeight: '1.5',
        wordBreak: 'break-all'
      }}>
        {logs.map((log, i) => {
          // 根据日志类型设置颜色
          let color = '#d4d4d4'
          if (log.includes('❌')) color = '#ff6b6b'
          if (log.includes('⚠️')) color = '#ffa500'
          if (log.includes('✅')) color = '#51cf66'
          if (log.includes('📡')) color = '#74c0fc'

          return (
            <div key={i} style={{ marginBottom: '4px', color }}>
              {log}
            </div>
          )
        })}
        {logs.length === 0 && <div style={{ color: '#666' }}>暂无日志...</div>}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <a href="/" style={{ color: '#007AFF', textDecoration: 'none' }}>🏠 返回首页</a>
        <a href="/practice" style={{ color: '#007AFF', textDecoration: 'none' }}>🎯 去练习页</a>
        <a href="/topics" style={{ color: '#007AFF', textDecoration: 'none' }}>📚 去素材页</a>
        <button
          onClick={clearLogs}
          style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px' }}
        >
          🗑️ 清空日志
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px' }}
        >
          🔄 刷新
        </button>
      </div>

      <div style={{ marginTop: '15px', padding: '10px', background: '#f0f0f0', borderRadius: '6px', fontSize: '12px', color: '#333' }}>
        <strong>使用说明：</strong>
        <ol style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
          <li>保持此页面打开（日志会自动捕获）</li>
          <li>在新标签页打开"去练习页"</li>
          <li>选择一个素材，等待错误发生</li>
          <li>返回此页面查看捕获的日志</li>
        </ol>
      </div>
    </div>
  )
}
