"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSuccessSound } from "@/hooks/useSuccessSound"
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
}

export default function WordMode({ sentence, onComplete, currentIndex, totalSentences, onNext, isLastSentence, dictationMode = "word", onDictationModeChange }: WordModeProps) {
  const { playSuccessSound } = useSuccessSound() // 使用全局静音状态
  const [userInput, setUserInput] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showWord, setShowWord] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)  // 控制翻译显示状态
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false)  // 模式下拉框状态

  // V3.1 有效作答时间跟踪
  const [timingStarted, setTimingStarted] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const pausedDurationRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  const sentenceWords = sentence.text
    .trim()
    .split(/\s+/)  // 使用正则表达式分割所有空白字符（空格、制表符等）
    .filter(w => w.length > 0)

  // Randomly select a word to hide (using seeded random based on sentence.id for consistency)
  const { hiddenWordIndex, hiddenWord, visibleWordsBefore, visibleWordsAfter } = useMemo(() => {
    if (sentenceWords.length === 0) {
      return {
        hiddenWordIndex: 0,
        hiddenWord: "",
        visibleWordsBefore: [],
        visibleWordsAfter: []
      }
    }

    // Use sentence.id as a seed for consistent random selection
    const seed = sentence.id || 1
    const randomIndex = seed % sentenceWords.length

    return {
      hiddenWordIndex: randomIndex,
      hiddenWord: sentenceWords[randomIndex],
      visibleWordsBefore: sentenceWords.slice(0, randomIndex),
      visibleWordsAfter: sentenceWords.slice(randomIndex + 1)
    }
  }, [sentence.id, sentenceWords])

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
    setShowTranslation(false)  // 重置翻译显示状态

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
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        {/* First row: Show translation button */}
        {sentence.translation && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              {showTranslation ? "Hide Translation" : "Show Translation"}
            </button>
          </div>
        )}

        {/* 第二行：原文 */}
        <p className="text-lg leading-relaxed">
          {sentence.text ? (
            <>
              {visibleWordsBefore.length > 0 && visibleWordsBefore.map((word, index) => (
                <span key={index} className="text-gray-800">{word} </span>
              ))}
              <span className="inline-block border-b-2 border-blue-500 px-4 min-w-[100px] text-center text-blue-600 font-medium">[     ]</span>
              {visibleWordsAfter.length > 0 && visibleWordsAfter.map((word, index) => (
                <span key={index} className="text-gray-800"> {word}</span>
              ))}
              {/* 调试：如果没有单词，显示提示 */}
              {visibleWordsBefore.length === 0 && visibleWordsAfter.length === 0 && (
                <span className="text-red-500 text-xs ml-2">
                  (Words: {sentenceWords.length})
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400 italic">Loading...</span>
          )}
        </p>

        {/* 中文翻译显示 */}
        {showTranslation && sentence.translation && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600 italic">
              {/* 向后兼容：支持旧的 string 格式和新的 Translation JSONB 格式 */}
              {typeof sentence.translation === 'string'
                ? sentence.translation
                : (sentence.translation?.['zh'] || '')}
            </p>
          </div>
        )}
      </div>

      {/* Label with Filter */}
      <div className="mb-2 relative">
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
