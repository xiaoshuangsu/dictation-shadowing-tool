/**
 * ClickableWord - 通用可点击单词组件
 *
 * 功能：
 * - 封装单词点击逻辑
 * - 显示单词释义悬浮气泡
 * - 支持智能状态感知（Dictation 模式下的隐藏单词）
 * - 复用词典缓存
 * - 已存生词的单词显示下划线标记
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import WordTooltip, { WordDefinition } from './WordTooltip'
import { fetchWordDefinition } from '@/lib/utils/wordTranslation'
import { useUserVocabulary } from '@/lib/hooks/useUserVocabulary'

interface ClickableWordProps {
  word: string
  originalWord?: string  // 原始单词（用于大小写保留）
  contextSentence: string  // 完整句子，用于保存到生词本
  isHidden?: boolean  // 是否在 Dictation 模式下被隐藏
  materialId?: string
  materialTitle?: string
  className?: string
  children?: React.ReactNode  // 自定义渲染内容
}

export default function ClickableWord({
  word,
  originalWord,
  contextSentence,
  isHidden = false,
  materialId,
  materialTitle,
  className = '',
  children
}: ClickableWordProps) {
  const { isWordSaved } = useUserVocabulary()
  const [isSaved, setIsSaved] = useState(false)

  // 检查单词是否已保存
  useEffect(() => {
    const checkWord = async () => {
      const saved = await isWordSaved(originalWord || word)
      setIsSaved(saved)
    }
    checkWord()
  }, [isWordSaved, originalWord, word])

  // Tooltip 状态
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean
    definition: WordDefinition | null
    loading: boolean
    position: { x: number; y: number }
  }>({
    visible: false,
    definition: null,
    loading: false,
    position: { x: 0, y: 0 }
  })

  // 关闭 Tooltip
  const closeTooltip = useCallback(() => {
    setTooltipState(prev => ({ ...prev, visible: false }))
  }, [])

  // 处理单词点击
  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation()

    // 智能状态感知：Dictation 模式下的隐藏单词
    if (isHidden) {
      // 显示提示：请先完成听写
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const x = rect.left + rect.width / 2 - 100
      const y = rect.bottom + 8

      // 创建临时提示
      showToast(event, "请先完成听写")
      return
    }

    // 获取点击位置
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const x = rect.left + rect.width / 2 - 160 // 居中显示（tooltip 宽度的一半）
    const y = rect.bottom + 8 // 单词下方 8px

    // 打开 Tooltip 并显示加载状态
    setTooltipState({
      visible: true,
      definition: null,
      loading: true,
      position: { x, y: y > 0 ? y : rect.top - 200 } // 如果底部空间不足，显示在上方
    })

    // 获取单词定义（复用词典缓存）
    try {
      const definition = await fetchWordDefinition(originalWord || word)
      setTooltipState(prev => ({
        ...prev,
        definition,
        loading: false
      }))
    } catch (error) {
      console.error('获取单词定义失败:', error)
      setTooltipState(prev => ({
        ...prev,
        definition: null,
        loading: false
      }))
    }
  }

  // 显示临时提示（用于隐藏单词的点击）
  const showToast = (event: React.MouseEvent, message: string) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect()

    // 创建 toast 元素
    const toast = document.createElement('div')
    toast.className = 'fixed z-50 px-3 py-2 bg-yellow-100 border border-yellow-400 text-yellow-800 text-sm rounded-lg shadow-lg animate-in fade-in zoom-in duration-200'
    toast.textContent = message
    toast.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`
    toast.style.top = `${rect.bottom + 8}px`

    document.body.appendChild(toast)

    // 2秒后自动消失
    setTimeout(() => {
      toast.classList.add('animate-out', 'fade-out', 'zoom-out')
      setTimeout(() => toast.remove(), 200)
    }, 2000)
  }

  return (
    <>
      <span
        onClick={handleClick}
        className={`cursor-pointer transition-colors ${
          isHidden
            ? 'cursor-not-allowed opacity-60'  // 隐藏单词：不可点击样式
            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-0.5'  // 可见单词：可点击样式
        } ${
          isSaved && !isHidden
            ? 'underline decoration-2 decoration-blue-500 decoration-offset-4'  // 已存生词：下划线标记
            : ''
        } ${className}`}
      >
        {children || word}
      </span>

      {/* Tooltip */}
      {tooltipState.visible && !isHidden && (
        <WordTooltip
          word={originalWord || word}
          definition={tooltipState.definition}
          loading={tooltipState.loading}
          position={tooltipState.position}
          sentence={contextSentence}
          materialId={materialId}
          materialTitle={materialTitle}
          onClose={closeTooltip}
        />
      )}

      {/* 点击遮罩层关闭 Tooltip */}
      {tooltipState.visible && !isHidden && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeTooltip}
        />
      )}
    </>
  )
}
