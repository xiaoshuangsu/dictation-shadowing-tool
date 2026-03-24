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

interface ClickableTranscriptProps {
  sentences: Sentence[]
  currentIndex: number
  highlightIndex?: number | null  // 🔴 跳转播放时高亮的句子索引
  onSelectSentence: (index: number) => void
  showTranscript: boolean
  onToggleTranscript: () => void
  translationLanguage: string
  materialId?: string
  materialTitle?: string
  audioSrc?: string
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
  audioSrc
}: ClickableTranscriptProps) {
  // 🔴 自动滚动：存储每个句子元素的引用
  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([])
  // 🔴 禁用初始化自动滚动：跟踪组件是否已经挂载
  const isMountedRef = useRef(false)

  // 🔴 标记组件已挂载
  useEffect(() => {
    isMountedRef.current = true
    console.log('🔧 [ClickableTranscript] 组件已挂载，启用自动滚动')
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 🔴 自动滚动：当 currentIndex 变化时，平滑滚动到当前句子
  // 🔴 关键修复：只在组件挂载后才触发自动滚动，防止初始化时页面跳动
  useEffect(() => {
    // 🔴 禁止初始化自动滚动
    if (!isMountedRef.current) {
      console.log('🚫 [ClickableTranscript] 组件未挂载，跳过自动滚动')
      return
    }

    if (currentIndex >= 0 && currentIndex < sentenceRefs.current.length) {
      const targetElement = sentenceRefs.current[currentIndex]
      if (targetElement) {
        console.log('🔄 [ClickableTranscript] 自动滚动到句子', currentIndex)
        // 使用 scrollIntoView 平滑滚动到当前句子
        // block: 'start' 确保句子滚动到容器顶部
        // behavior: 'smooth' 实现平滑滚动效果
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        })
      }
    }
  }, [currentIndex])

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

      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto transcript-scroll-container">
        {sentences.map((sentence, index) => {
          // 🔴 判断是否为高亮句子（跳转播放时的视觉焦点）
          const isHighlighted = highlightIndex === index

          return (
            <div
              key={sentence.id}
              ref={(el) => {
                sentenceRefs.current[index] = el
              }}
              onClick={() => {
                onSelectSentence(index)
              }}
              className={`p-3 rounded cursor-pointer transition-all ${
                isHighlighted
                  ? 'bg-yellow-100 border-2 border-yellow-400 animate-pulse shadow-lg scale-105'  // 🔴 高亮闪烁效果
                  : index === currentIndex
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
                  {/* 🔴 SEO 优化：始终渲染真实内容，使用 CSS 控制可见性 */}
                  {/* 这样搜索引擎可以抓取到完整的 Transcript 内容 */}
                  <div className={!showTranscript ? 'blur-sm select-none' : ''}>
                    <ClickableSentence
                      text={sentence.text}
                      sentence={sentence}
                      materialId={materialId}
                      materialTitle={materialTitle}
                      audioSrc={audioSrc}
                    />
                  </div>

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
  )
}

/**
 * 可点击单词的句子组件
 *
 * 将句子拆分为单词和分隔符，只有单词可以点击
 * 使用通用的 ClickableWord 组件
 */
interface ClickableSentenceProps {
  text: string
  sentence: Sentence
  materialId?: string
  materialTitle?: string
  audioSrc?: string
}

function ClickableSentence({ text, sentence, materialId, materialTitle, audioSrc }: ClickableSentenceProps) {
  // 分词
  const tokens = tokenizeSentence(text)

  return (
    <p className="text-base text-gray-900 leading-relaxed">
      {tokens.map((token, index) => {
        if (token.isWord) {
          return (
            <ClickableWord
              key={index}
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
          return <span key={index}>{token.text}</span>
        }
      })}
    </p>
  )
}
