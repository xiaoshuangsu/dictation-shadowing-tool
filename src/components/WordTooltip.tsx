/**
 * WordTooltip - 单词释义悬浮气泡组件
 *
 * 功能：
 * - 显示单词、音标、多语言释义
 * - 提供"学习"按钮保存到生词本
 * - 根据全局翻译语言设置显示对应语言
 */

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'

export interface WordDefinition {
  word: string
  phonetic: string
  definitions: {
    'zh-CN': string
    'zh-Hant': string
    'vi': string
    'en': string
  }
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

// 语言代码映射
const LANGUAGE_MAP: Record<string, keyof WordDefinition['definitions']> = {
  'zh': 'zh-CN',
  'zh_hant': 'zh-Hant',
  'vi': 'vi',
  'hide': 'zh-CN'  // 默认简体中文
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
  const [currentLanguage, setCurrentLanguage] = useState<keyof WordDefinition['definitions']>('zh-CN')

  // 同步全局翻译语言设置
  useEffect(() => {
    const storedLang = getStoredLanguage()
    const mappedLang = LANGUAGE_MAP[storedLang] || 'zh-CN'
    setCurrentLanguage(mappedLang)
  }, [])

  // 根据当前选择的语言获取释义
  const getCurrentDefinition = () => {
    if (!definition) return ''
    return definition.definitions[currentLanguage] || definition.definitions['zh-CN'] || ''
  }

  // 保存生词到数据库
  const handleSaveWord = async () => {
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id}` },
        body: JSON.stringify({
          userId: user.id,
          word: definition.word,
          phonetic: definition.phonetic,
          definition: JSON.stringify(definition.definitions),  // 存储多语言 JSON
          contextSentence: sentence,
          materialId,
          materialTitle
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: data.isNew ? '已加入学习列表' : '已更新为学习中'
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

  // 切换显示语言
  const handleLanguageChange = (lang: keyof WordDefinition['definitions']) => {
    setCurrentLanguage(lang)
  }

  // 计算位置：确保气泡不超出屏幕边界
  const getPositionStyle = () => {
    const tooltipWidth = 320
    const tooltipHeight = 280

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

  const LANGUAGE_OPTIONS = [
    { code: 'zh-CN', label: '简' },
    { code: 'zh-Hant', label: '繁' },
    { code: 'vi', label: 'VN' },
    { code: 'en', label: 'EN' }
  ]

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

          {/* 语言切换 */}
          <div className="flex gap-1 border-b border-gray-200 pb-2">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code as keyof WordDefinition['definitions'])}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLanguage === lang.code
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* 释义 */}
          <div>
            <p className="text-sm text-gray-700">{getCurrentDefinition()}</p>
          </div>

          {/* 例句（如果有） */}
          {definition.example && (
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-600 italic">{definition.example}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="pt-2">
            <button
              onClick={handleSaveWord}
              disabled={saving || !!message}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? '保存中...' : '加入生词本'}
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
