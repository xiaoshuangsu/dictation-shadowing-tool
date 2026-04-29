/**
 * ClickableTranscript - 可点击单词的 Transcript 组件
 *
 * 功能：
 * - 渲染练习页面的右侧 Transcript 栏
 * - 每个单词可点击（使用通用的 ClickableWord 组件）
 * - 点击后显示单词释义悬浮气泡
 * - 支持将单词加入生词本
 * - 自动滚动到当前句子（防止移动端 Layout Shift）
 */

'use client'

import { useRef, useEffect } from 'react'
import ClickableWord from './ClickableWord'
import { tokenizeSentence } from '@/lib/utils/wordTranslation'
import type { Sentence } from '@/types'
import logger from '@/lib/utils/logger'

interface ClickableTranscriptProps {
  sentences: Sentence[]
  currentIndex: number
  highlightIndex?: number | null
  onSelectSentence: (index: number) => void
  showTranscript: boolean
  onToggleTranscript: () => void
  translationLanguage: string
  materialId?: string
  materialTitle?: string
  audioSrc?: string
  hasStarted?: boolean
  isBlocked?: boolean
}

export default function ClickableTranscript({
  sentences,
  currentIndex,
  highlightIndex,
  onSelectSentence,
  showTranscript,
  onToggleTranscript,
  translationLanguage,
  materialId,
  materialTitle,
  audioSrc,
  hasStarted = false,
  isBlocked = false
}: ClickableTranscriptProps) {
  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(false)
  const lastClickTimeRef = useRef(0)  // 🔥 v30.6.8: 防抖 - 记录上次点击时间
  const clickDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)  // 🔥 v30.6.9: 防抖定时器
  const DEBOUNCE_MS = 1200  // 🔥 v30.6.10: 防抖延迟增加到 1200ms，与 YouTubePlayer 锁定时间对齐

  useEffect(() => {
    isMountedRef.current = true
    logger.debug('[ClickableTranscript] 组件已挂载')

    if (containerRef.current) {
      containerRef.current.scrollTop = 0
      logger.debug('[ClickableTranscript] 初始化：强制 scrollTop = 0')
    }

    return () => {
      isMountedRef.current = false
      // 🔥 v30.6.9: 清理防抖定时器
      if (clickDebounceTimerRef.current) {
        clearTimeout(clickDebounceTimerRef.current)
        clickDebounceTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isMountedRef.current) {
      logger.debug('[ClickableTranscript] 组件未挂载，跳过自动滚动')
      return
    }

    if (!hasStarted) {
      logger.debug('[ClickableTranscript] 未开始播放，跳过自动滚动')
      return
    }

    if (currentIndex >= 0 && currentIndex < sentenceRefs.current.length) {
      const targetElement = sentenceRefs.current[currentIndex]
      const container = containerRef.current

      if (targetElement && container) {
        logger.debug('[ClickableTranscript] 容器内滚动到句子', currentIndex)

        const targetScrollTop = targetElement.offsetTop - container.offsetTop - 24

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        })
      }
    }
  }, [currentIndex, hasStarted])

  return (
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

      <div
        ref={containerRef}
        className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pt-4 transcript-scroll-container"
      >
        {sentences.map((sentence, index) => {
          const isHighlighted = highlightIndex === index

          return (
            <div
              key={sentence.id}
              ref={(el) => {
                sentenceRefs.current[index] = el
              }}
              onClick={() => {
                // 🔥 v30.6.10: 增强防抖 - 使用定时器机制，确保 1200ms 内只处理一次点击
                if (clickDebounceTimerRef.current) {
                  return
                }

                clickDebounceTimerRef.current = setTimeout(() => {
                  clickDebounceTimerRef.current = null
                }, DEBOUNCE_MS)

                lastClickTimeRef.current = Date.now()
                onSelectSentence(index)
              }}
              className={`p-3 rounded cursor-pointer transition-all relative ${
                isHighlighted
                  ? 'bg-yellow-100 border-2 border-yellow-400 animate-pulse shadow-lg scale-105'
                  : index === currentIndex
                  ? 'bg-blue-100 border-2 border-blue-500'
                  : index < currentIndex
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              } ${isBlocked ? 'cursor-not-allowed opacity-75' : ''}`}
              style={{ scrollMarginTop: '40px' }}
            >
              {isBlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded hover:bg-black/10 transition-colors">
                  <svg className="w-5 h-5 text-purple-600 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}

              <div className={`flex items-start gap-2 ${isBlocked ? 'opacity-50' : ''}`}>
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
                  <div className={!showTranscript ? 'blur-sm select-none' : ''}>
                    <ClickableSentence
                      text={sentence.text}
                      sentence={sentence}
                      materialId={materialId}
                      materialTitle={materialTitle}
                      audioSrc={audioSrc}
                    />
                  </div>

                  {showTranscript && (
                    <p className="text-sm italic mt-1">
                      {(() => {
                        // 安全获取翻译文本
                        let translationText = ''

                        if (typeof sentence.translation === 'string') {
                          translationText = sentence.translation
                        } else if (sentence.translation && typeof sentence.translation === 'object') {
                          translationText = sentence.translation[translationLanguage] || ''
                        }

                        // 如果翻译为空，显示原文（灰色标记）
                        if (!translationText || translationText.trim() === '') {
                          return (
                            <span className="text-gray-400">
                              {sentence.text}
                              <span className="text-xs text-gray-300 ml-1">(Translating...)</span>
                            </span>
                          )
                        }

                        // 正常显示翻译
                        return <span className="text-gray-700">{translationText}</span>
                      })()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ClickableSentenceProps {
  text: string
  sentence: Sentence
  materialId?: string
  materialTitle?: string
  audioSrc?: string
}

function ClickableSentence({ text, sentence, materialId, materialTitle, audioSrc }: ClickableSentenceProps) {
  const tokens = tokenizeSentence(text)

  return (
    // 🔥 修复 Hydration Error：将 <p> 改为 <div>，避免嵌套 WordTooltip 的 <div>
    <div className="text-base text-gray-900 leading-relaxed">
      {tokens.map((token, index) => {
        if (token.isWord) {
          // 🔥 V30.3.6: 修复 key 稳定性，使用单词本身+index 而非纯 index
          // 防止 ClickableWord 频繁重新挂载，触发海量 useUserVocabulary 请求
          const stableKey = `${token.originalWord || token.text}-${index}`

          return (
            <ClickableWord
              key={stableKey}
              word={token.text}
              originalWord={token.originalWord}
              contextSentence={sentence.text}
              materialId={materialId}
              materialTitle={materialTitle}
              audioTimestamp={String(sentence.startTime)}
              audioUrl={audioSrc}
            />
          )
        } else {
          return <span key={`${token.text}-${index}`}>{token.text}</span>
        }
      })}
    </div>
  )
}
