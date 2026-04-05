"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSuccessSound } from "@/hooks/useSuccessSound"
import { TranslationLanguageSelector, type TranslationLanguage, getStoredLanguage } from "@/components/TranslationLanguageSelector"
import type { Sentence } from "@/types"

interface WordModeProps {
  sentence: Sentence
  onComplete?: (isCorrect: boolean, usedShowWords?: boolean, durationSeconds?: number) => void
  currentIndex: number
  totalSentences: number
  onNext?: () => void
  isLastSentence?: boolean
  dictationMode?: "word" | "whole"
  onDictationModeChange?: (mode: "word" | "whole") => void
  translationLanguage?: TranslationLanguage
  showTranslation?: boolean
  onTranslationLanguageChange?: (language: TranslationLanguage, showTranslation: boolean) => void
}

export default function WordMode({
  sentence,
  onComplete,
  currentIndex,
  totalSentences,
  onNext,
  isLastSentence,
  dictationMode = "word",
  onDictationModeChange,
  translationLanguage: externalTranslationLanguage,
  showTranslation: externalShowTranslation,
  onTranslationLanguageChange
}: WordModeProps) {
  const { playSuccessSound } = useSuccessSound() // 使用全局静音状态
  const [userInput, setUserInput] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showWord, setShowWord] = useState(false)
  const [internalTranslationLanguage, setInternalTranslationLanguage] = useState<TranslationLanguage>(getStoredLanguage())
  const [internalShowTranslation, setInternalShowTranslation] = useState(false)
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false)  // 模式下拉框状态

  // 使用外部翻译语言状态（如果提供），否则使用内部状态
  const translationLanguage = externalTranslationLanguage ?? internalTranslationLanguage
  const showTranslation = externalShowTranslation ?? internalShowTranslation

  // V3.1 有效作答时间跟踪
  const [timingStarted, setTimingStarted] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const pausedDurationRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 🔥 v6.1 修复：改用空格分词，与挖空脚本保持一致
  // 挖空脚本使用 sentence.text.split(' ') 分词，index 基于空格分割
  const spaceTokens = (sentence.text || '').split(' ')

  // 🔥 v6.1 修复：改进分词逻辑，保留标点符号（用于渲染）
  // 同时保留单词、标点符号和空格，确保渲染时完整显示原文
  // 🔥 v6.1.1 修复：支持弯撇号 U+2019（智能引号），解决 "It's" 被拆分的问题
  const renderTokens = (sentence.text || '').match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g) || []

  // 调试日志
  if (process.env.NODE_ENV === 'development') {
    console.log('[WordMode] Sentence data:', {
      hasText: !!sentence.text,
      textLength: sentence.text?.length || 0,
      textPreview: sentence.text?.substring(0, 50) || 'EMPTY',
      hasTranslation: !!sentence.translation,
      translationType: typeof sentence.translation
    })
  }

  // Select word to hide:优先使用 sentence.blanks，否则使用随机算法
  const { targetTokenIndex, hiddenWord } = useMemo(() => {
    if (spaceTokens.length === 0) {
      return {
        targetTokenIndex: -1,
        hiddenWord: ""
      }
    }

    // 优先使用 sentence.blanks 字段（如果存在且有效）
    if (sentence.blanks && sentence.blanks.length > 0 && sentence.blanks[0]) {
      const blank = sentence.blanks[0]
      const blankWord = blank.word
      const blankIndex = blank.index

      // 验证 blankIndex 是否在有效范围内
      if (blankIndex >= 0 && blankIndex < spaceTokens.length) {
        const wordAtIndex = spaceTokens[blankIndex]

        // 验证 word 是否匹配（忽略标点和大小写）
        const cleanBlankWord = blankWord.toLowerCase().replace(/[.,!?;:'""]/g, '')
        const cleanWordAtIndex = wordAtIndex.toLowerCase().replace(/[.,!?;:'""]/g, '')

        if (cleanBlankWord === cleanWordAtIndex || cleanWordAtIndex.includes(cleanBlankWord)) {
          // 在 renderTokens 中找到对应的 token（用于渲染）
          // 需要从 spaceTokens 转换到 renderTokens 的索引
          let renderIndex = -1
          let spaceTokenCount = 0

          for (let i = 0; i < renderTokens.length; i++) {
            const token = renderTokens[i]
            // 跳过纯标点和纯空格的 token
            if (/^\s+$/.test(token) || /^[.,!?;:]+$/.test(token)) {
              continue
            }
            // 找到第 blankIndex 个非标点/空格的 token
            if (spaceTokenCount === blankIndex) {
              renderIndex = i
              break
            }
            spaceTokenCount++
          }

          if (renderIndex >= 0) {
            return {
              targetTokenIndex: renderIndex,
              hiddenWord: blankWord  // 使用 blanks 中的原始 word（不含标点）
            }
          }
        }
      }
    }

    // 🔴 修复：如果没有有效的 blanks 字段，不挖空（而不是使用随机算法）
    // 随机算法会导致挖空黑名单词（如 my, that, is 等）
    return {
      targetTokenIndex: -1,  // -1 表示不挖空
      hiddenWord: ""
    }
  }, [sentence.id, spaceTokens, renderTokens, sentence.blanks])

  // V3.1: 启动计时
  const startTiming = () => {
    if (!timingStarted) {
      setTimingStarted(true)
      startTimeRef.current = Date.now()
      pausedDurationRef.current = 0
      lastActivityRef.current = Date.now()
    }
  }

  // V3.1: 暂停/恢复计时
  const pauseTiming = () => {
    if (timingStarted && !pauseStartRef.current) {
      pauseStartRef.current = Date.now()
    }
  }

  const resumeTiming = () => {
    if (timingStarted && pauseStartRef.current) {
      const pauseDuration = Date.now() - pauseStartRef.current
      pausedDurationRef.current += pauseDuration
      pauseStartRef.current = null
      lastActivityRef.current = Date.now()
    }
  }

  // V3.1: 更新活动时间
  const updateActivity = () => {
    lastActivityRef.current = Date.now()
    startTiming()

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    inactivityTimerRef.current = setTimeout(() => {
      pauseTiming()
    }, 60000)
  }

  // V3.1: 监听浏览器失焦/聚焦
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseTiming()
      } else {
        resumeTiming()
        updateActivity()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timingStarted])

  // V3.1: 计算有效作答时间
  const calculateEffectiveTime = (): number => {
    if (!startTimeRef.current) return 0

    const endTime = Date.now()
    const rawSeconds = (endTime - startTimeRef.current - pausedDurationRef.current) / 1000

    // 有效性过滤
    if (rawSeconds < 3) {
      return 0
    }

    const sentenceStartTime = typeof sentence.startTime === 'string' ? parseFloat(sentence.startTime) : sentence.startTime
    const sentenceEndTime = typeof sentence.endTime === 'string' ? parseFloat(sentence.endTime) : sentence.endTime
    const audioDuration = sentenceEndTime - sentenceStartTime
    const maxSeconds = Math.min(180, audioDuration * 5)
    const effectiveSeconds = Math.min(rawSeconds, maxSeconds)

    return Math.round(effectiveSeconds)
  }

  // Reset when sentence changes
  useEffect(() => {
    setUserInput("")
    setShowResult(false)
    setIsCorrect(null)
    setShowWord(false)

    // 重置计时状态
    setTimingStarted(false)
    startTimeRef.current = null
    pausedDurationRef.current = 0
    pauseStartRef.current = null
    lastActivityRef.current = Date.now()
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }, [sentence.id])

  // Check if word is correct
  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
  }

  const checkWordCorrect = () => {
    return normalizeText(userInput) === normalizeText(hiddenWord || "")
  }

  const handleSubmitWord = () => {
    const correct = checkWordCorrect()
    setShowResult(true)
    setIsCorrect(correct)

    // 如果完全正确，播放成功音效
    if (correct) {
      playSuccessSound()
    }

    // V3.1: 计算有效作答时间（秒）
    const durationSeconds = calculateEffectiveTime()

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    if (onComplete) {
      onComplete(correct, false, durationSeconds)
    }
  }

  const handleShowWord = () => {
    setShowWord(true)
    setUserInput(hiddenWord)
    setIsCorrect(true)

    // V3.1: 计算有效作答时间（秒）
    const durationSeconds = calculateEffectiveTime()

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    if (onComplete) {
      onComplete(true, true, durationSeconds)
    }
  }

  const handleNext = () => {
    if (onNext && !isLastSentence) {
      onNext()
    }
  }

  // 处理翻译语言变化
  const handleLanguageChange = (language: TranslationLanguage, show: boolean) => {
    setInternalTranslationLanguage(language)
    setInternalShowTranslation(show)
    onTranslationLanguageChange?.(language, show)
  }

  // 获取当前语言的翻译文本（带安全保护）
  const getCurrentTranslation = (): string => {
    // 如果 translation 为 null 或 undefined，返回空字符串
    if (!sentence.translation) return ''

    // 向后兼容：支持旧的 string 格式
    if (typeof sentence.translation === 'string') {
      return sentence.translation || ''
    }

    // 新的 Translation JSONB 格式（安全访问）
    if (typeof sentence.translation === 'object') {
      return sentence.translation[translationLanguage] || ''
    }

    return ''
  }

  // 获取显示文本（翻译或原文）
  const getDisplayText = (): { text: string; isFallback: boolean } => {
    const translation = getCurrentTranslation()

    // 如果翻译为空，返回原文作为后备
    if (!translation || translation.trim() === '') {
      return {
        text: sentence.text,
        isFallback: true
      }
    }

    return {
      text: translation,
      isFallback: false
    }
  }

  const currentTranslation = getCurrentTranslation()
  const displayText = getDisplayText()

  // 获取语言标签（与 TranslationLanguageSelector 保持一致）
  const getLanguageLabel = (lang: TranslationLanguage): string => {
    const labels = {
      'zh': '中文 (简体)',
      'zh_hant': '中文 (繁體)',
      'vi': 'Tiếng Việt',
      'ar': 'العربية',
      'de': 'Deutsch',
      'es': 'Español',
      'ja': '日本語',
      'ms': 'Bahasa Melayu',
      'ru': 'Русский',
      'tr': 'Türkçe',
      'el': 'Ελληνικά',
      'id': 'Bahasa Indonesia',
      'ko': '한국어',
      'pt': 'Português',
      'th': 'ภาษาไทย',
      'uk': 'Українська',
      'bn': 'বাংলা',
      'mn': 'Монгол',
      'hi': 'हिन्दी',
      'hide': ''
    }
    return labels[lang] || ''
  }

  const languageLabel = getLanguageLabel(translationLanguage)

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!showResult && userInput.trim()) {
        handleSubmitWord()
      }
    }
  }

  return (
    <div>
      {/* Display Text with One Hidden Word */}
      <div className="relative mb-6 p-4 pr-10 bg-gray-50 rounded-lg">
        {/* Language selector - 绝对定位在卡片右上角 */}
        {sentence.translation && (
          <div className="absolute top-2 right-2">
            <TranslationLanguageSelector onLanguageChange={handleLanguageChange} />
          </div>
        )}

        {/* 第二行：原文 */}
        <p className="text-lg leading-relaxed">
          {sentence.text ? (
            <>
              {/* 🔥 v6.1 修复：基于 renderTokens 渲染，保留所有标点符号 */}
              {targetTokenIndex >= 0 ? (
                <>
                  {renderTokens.map((token, index) => {
                    // 如果是挖空位置，渲染输入框
                    if (index === targetTokenIndex) {
                      return (
                        <span key={index} className="inline-block border-b-2 border-blue-500 px-4 min-w-[100px] text-center text-blue-600 font-medium">
                          [     ]
                        </span>
                      )
                    }
                    // 其他位置，直接渲染原 token（包含标点和空格）
                    return <span key={index}>{token}</span>
                  })}
                </>
              ) : (
                /* 没有挖空词时，直接显示原始文本，不显示下划线 */
                <span className="text-gray-800">{sentence.text}</span>
              )}
            </>
          ) : (
            <span className="text-gray-400 italic">Loading...</span>
          )}
        </p>

        {/* 翻译显示 - 如果翻译为空则显示原文 */}
        {showTranslation && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className={`text-sm italic ${displayText.isFallback ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="font-medium text-gray-700">{languageLabel}:</span> {displayText.text}
              {displayText.isFallback && (
                <span className="text-xs text-gray-300 ml-1">(Translating...)</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Label with Filter */}
      <div className="mb-2">
        <label className="text-sm font-medium text-gray-700">
          {"Type what you hear"}:
        </label>
        <div className="inline-block relative ml-2">
          <button
            type="button"
            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {dictationMode === "word" ? "Word" : "Sentence"}
            <svg className={`w-3 h-3 transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isModeDropdownOpen && (
            <div className="absolute left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-full">
              <button
                type="button"
                onClick={() => {
                  onDictationModeChange?.("word")
                  setIsModeDropdownOpen(false)
                }}
                className="w-full px-4 py-2.5 text-sm text-left text-gray-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                Word
              </button>
              <button
                type="button"
                onClick={() => {
                  onDictationModeChange?.("whole")
                  setIsModeDropdownOpen(false)
                }}
                className="w-full px-4 py-2.5 text-sm text-left text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Sentence
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="relative mb-4">
        <textarea
          value={showWord ? hiddenWord : userInput}
          onChange={(e) => {
            setUserInput(e.target.value)
            // V3.1: 更新活动时间
            if (e.target.value.length > 0) {
              updateActivity()
            }
            // Allow editing again by clearing result
            if (showResult) {
              setShowResult(false)
              setIsCorrect(null)
            }
          }}
          onFocus={updateActivity}
          onKeyDown={handleKeyDown}
          disabled={showWord}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder={showWord ? "Correct answer shown (editable)" : "Type your answer here..."}
        />
      </div>

      {/* Result Display */}
      {showResult && isCorrect === false && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-700 mb-2">
            {"Not correct. Please listen again and try!"}
          </p>
          <button
            onClick={handleShowWord}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
          >
            {"Show Word"}
          </button>
        </div>
      )}

      {showResult && isCorrect === true && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            {"✓ Correct!"}
          </p>
        </div>
      )}

      {/* Submit / Next Button */}
      <button
        onClick={showResult ? handleNext : handleSubmitWord}
        disabled={!showResult && !userInput.trim()}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {showResult ? (
          <>
            {"Next"}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        ) : (
          "Check"
        )}
      </button>
    </div>
  )
}
