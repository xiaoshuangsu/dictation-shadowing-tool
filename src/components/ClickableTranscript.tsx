/**
 * ClickableTranscript - 可点击单词的 Transcript 组件
 *
 * 功能：
 * - 渲染练习页面的右侧 Transcript 栏
 * - 每个单词可点击
 * - 点击后显示单词释义悬浮气泡
 * - 支持将单词加入生词本
 */

'use client'

import { useState, useCallback } from 'react'
import WordTooltip, { WordDefinition } from './WordTooltip'
import { fetchWordDefinition, tokenizeSentence } from '@/lib/utils/wordTranslation'
import type { Sentence } from '@/types'

interface ClickableTranscriptProps {
  sentences: Sentence[]
  currentIndex: number
  onSelectSentence: (index: number) => void
  showTranscript: boolean
  onToggleTranscript: () => void
  translationLanguage: string
  materialId?: string
  materialTitle?: string
}

export default function ClickableTranscript({
  sentences,
  currentIndex,
  onSelectSentence,
  showTranscript,
  onToggleTranscript,
  translationLanguage,
  materialId,
  materialTitle
}: ClickableTranscriptProps) {
  // Tooltip 状态
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean
    word: string
    definition: WordDefinition | null
    loading: boolean
    position: { x: number; y: number }
    sentence: string
  }>({
    visible: false,
    word: '',
    definition: null,
    loading: false,
    position: { x: 0, y: 0 },
    sentence: ''
  })

  // 关闭 Tooltip
  const closeTooltip = useCallback(() => {
    setTooltipState(prev => ({ ...prev, visible: false }))
  }, [])

  // 处理单词点击
  const handleWordClick = async (word: string, sentence: string, event: React.MouseEvent) => {
    event.stopPropagation()

    // 获取点击位置
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const x = rect.left + rect.width / 2 - 160 // 居中显示（tooltip 宽度的一半）
    const y = rect.bottom + 8 // 单词下方 8px

    // 打开 Tooltip 并显示加载状态
    setTooltipState({
      visible: true,
      word,
      definition: null,
      loading: true,
      position: { x, y: y > 0 ? y : rect.top - 200 }, // 如果底部空间不足，显示在上方
      sentence
    })

    // 获取单词定义
    try {
      const definition = await fetchWordDefinition(word)
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

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-4 sticky top-40">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Transcript</h3>
          <button
            onClick={onToggleTranscript}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            {showTranscript ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
          {sentences.map((sentence, index) => {
            // Convert text to asterisks when hidden
            const displayText = showTranscript
              ? sentence.text
              : sentence.text.split(/\s+/).map(() => '***').join(' ')

            return (
              <div
                key={sentence.id}
                onClick={() => {
                  onSelectSentence(index)
                }}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  index === currentIndex
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : index < currentIndex
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-sm font-semibold ${
                    index < currentIndex
                      ? 'bg-green-500 text-white'
                      : index === currentIndex
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* 🔴 可点击单词的句子渲染 */}
                    {showTranscript ? (
                      <ClickableSentence
                        text={displayText}
                        sentence={sentence.text}
                        onWordClick={handleWordClick}
                      />
                    ) : (
                      <p className="text-base text-gray-900 leading-relaxed">
                        {displayText}
                      </p>
                    )}

                    {/* 翻译 */}
                    {showTranscript && sentence.translation && (
                      <p className="text-sm text-gray-700 italic mt-1">
                        {/* 支持 Translation JSONB 格式，根据语言选择显示对应翻译 */}
                        {typeof sentence.translation === 'string'
                          ? sentence.translation
                          : (sentence.translation?.[translationLanguage] || '')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipState.visible && (
        <WordTooltip
          word={tooltipState.word}
          definition={tooltipState.definition}
          loading={tooltipState.loading}
          position={tooltipState.position}
          sentence={tooltipState.sentence}
          materialId={materialId}
          materialTitle={materialTitle}
          onClose={closeTooltip}
        />
      )}

      {/* 点击遮罩层关闭 Tooltip */}
      {tooltipState.visible && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeTooltip}
        />
      )}
    </>
  )
}

/**
 * 可点击单词的句子组件
 *
 * 将句子拆分为单词和分隔符，只有单词可以点击
 */
interface ClickableSentenceProps {
  text: string
  sentence: string
  onWordClick: (word: string, sentence: string, event: React.MouseEvent) => void
}

function ClickableSentence({ text, sentence, onWordClick }: ClickableSentenceProps) {
  // 分词
  const tokens = tokenizeSentence(text)

  return (
    <p className="text-base text-gray-900 leading-relaxed">
      {tokens.map((token, index) => {
        if (token.isWord) {
          return (
            <span
              key={index}
              onClick={(e) => onWordClick(token.originalWord!, sentence, e)}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-0.5 cursor-pointer transition-colors"
            >
              {token.text}
            </span>
          )
        } else {
          return <span key={index}>{token.text}</span>
        }
      })}
    </p>
  )
}
