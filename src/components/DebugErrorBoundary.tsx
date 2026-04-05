'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class DebugErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 DebugErrorBoundary 捕获到错误:', error)
    console.error('错误堆栈:', errorInfo.componentStack)

    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#fee',
          border: '2px solid red',
          margin: '20px',
          borderRadius: '8px'
        }}>
          <h2 style={{ color: 'red' }}>🚨 组件崩溃</h2>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              错误信息（点击展开）
            </summary>
            <div style={{ marginTop: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
              <p><strong>错误名称:</strong> {this.state.error?.name}</p>
              <p><strong>错误消息:</strong> {this.state.error?.message}</p>
              <p><strong>错误堆栈:</strong></p>
              <pre style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.error?.stack}
              </pre>
              <p><strong>组件堆栈:</strong></p>
              <pre style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '10px 20px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
