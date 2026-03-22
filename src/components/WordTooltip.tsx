/**
 * WordTooltip - 单词释义悬浮气泡组件
 *
 * 功能：
 * - 显示单词、音标、释义
 * - 提供"学习"和"掌握"按钮
 * - 点击按钮调用 API 保存到生词本
 */

'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

export interface WordDefinition {
  word: string
  phonetic: string
  definition: string
  example?: string
}

interface WordTooltipProps {
  word: string
  definition: WordDefinition | null
  loading: boolean
  position: { x: number; y: number }
  sentence: string
  materialId?: string
  materialTitle?: string
  onClose: () => void
}

export default function WordTooltip({
  word,
  definition,
  loading,
  position,
  sentence,
  materialId,
  materialTitle,
  onClose
}: WordTooltipProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 保存生词到数据库
  const handleSaveWord = async (masteryStatus: 'learning' | 'mastered') => {
    if (!user) {
      setMessage({ type: 'error', text: '请先登录' })
      setTimeout(() => setMessage(null), 2000)
      return
    }

    if (!definition) {
      setMessage({ type: 'error', text: '单词信息加载失败' })
      setTimeout(() => setMessage(null), 2000)
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          word: definition.word,
          phonetic: definition.phonetic,
          definition: definition.definition,
          contextSentence: sentence,
          materialId,
          materialTitle
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: masteryStatus === 'learning' ? '已加入学习列表' : '标记为已掌握'
        })
        setTimeout(() => {
          onClose()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: data.error || '保存失败' })
        setTimeout(() => setMessage(null), 2000)
      }
    } catch (error) {
      console.error('保存生词失败:', error)
      setMessage({ type: 'error', text: '网络错误，请重试' })
      setTimeout(() => setMessage(null), 2000)
    } finally {
      setSaving(false)
    }
  }

  // 计算位置：确保气泡不超出屏幕边界
  const getPositionStyle = () => {
    const tooltipWidth = 320
    const tooltipHeight = 200

    let x = position.x
    let y = position.y

    // 防止超出右边
    if (x + tooltipWidth > window.innerWidth - 20) {
      x = window.innerWidth - tooltipWidth - 20
    }

    // 防止超出底部
    if (y + tooltipHeight > window.innerHeight - 20) {
      y = position.y - tooltipHeight - 10
    }

    return { left: `${x}px`, top: `${y}px` }
  }

  return (
    <div
      className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 animate-in fade-in zoom-in duration-200"
      style={getPositionStyle()}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 内容区域 */}
      {!loading && definition && (
        <div className="space-y-3">
          {/* 单词和音标 */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {definition.word}
            </h3>
            {definition.phonetic && (
              <p className="text-sm text-gray-500 mt-1">{definition.phonetic}</p>
            )}
          </div>

          {/* 释义 */}
          <div>
            <p className="text-sm text-gray-700">{definition.definition}</p>
          </div>

          {/* 例句（如果有） */}
          {definition.example && (
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-600 italic">{definition.example}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleSaveWord('learning')}
              disabled={saving || !!message}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? '保存中...' : '学习'}
            </button>
            <button
              onClick={() => handleSaveWord('mastered')}
              disabled={saving || !!message}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? '保存中...' : '掌握'}
            </button>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`text-xs text-center py-2 rounded ${
              message.type === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      )}

      {/* 错误状态 */}
      {!loading && !definition && (
        <div className="text-center py-4 text-gray-500">
          未找到该单词的释义
        </div>
      )}
    </div>
  )
}
