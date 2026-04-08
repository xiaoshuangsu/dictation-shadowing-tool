/**
 * ErrorBoundary - 错误边界组件
 * 捕获子组件的错误，防止整个页面崩溃
 */
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class WordCardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[WordCardErrorBoundary] 捕获到错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-gray-200 bg-white rounded-lg">
          <p className="text-sm text-gray-500">加载失败</p>
        </div>
      )
    }

    return this.props.children
  }
}
