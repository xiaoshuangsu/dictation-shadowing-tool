"use client"

import { useState, useEffect, useRef } from "react"
import { Eye } from "lucide-react"
import ConfirmModal from "./ConfirmModal"
import { useLanguage } from "@/contexts/LanguageContext"
import { useSuccessSound } from "@/hooks/useSuccessSound"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string  // 可选的中文翻译字段
}

interface DictationBoxProps {
  sentence: Sentence
  onComplete?: (isCorrect: boolean, usedShowWords?: boolean, practiceMinutes?: number) => void
  onNext?: () => void
  isLastSentence?: boolean
}

type WordStatus = "correct" | "incorrect" | "pending"

export default function DictationBox({ sentence, onComplete, onNext, isLastSentence }: DictationBoxProps) {
  const { t } = useLanguage()
  const { playSuccessSound } = useSuccessSound(0.15) // 音量 0.15 - 降低音量避免刺耳
  const [userInput, setUserInput] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [showAllWords, setShowAllWords] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)  // 控制翻译显示状态

  // V3.1 有效作答时间跟踪
  const [timingStarted, setTimingStarted] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const pausedDurationRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Word-level state
  const sentenceWords = sentence.text.split(" ")
  const [wordStatuses, setWordStatuses] = useState<Map<number, WordStatus>>(new Map())
  const [peekedWords, setPeekedWords] = useState<Set<number>>(new Set()) // Track peeked words

  // V3.1: 启动计时（只触发一次）
  const startTiming = () => {
    if (!timingStarted) {
      setTimingStarted(true)
      startTimeRef.current = Date.now()
      pausedDurationRef.current = 0
      lastActivityRef.current = Date.now()
      console.log('DictationBox - Timing started')
    }
  }

  // V3.1: 暂停计时
  const pauseTiming = () => {
    if (timingStarted && !pauseStartRef.current) {
      pauseStartRef.current = Date.now()
      console.log('DictationBox - Timing paused')
    }
  }

  // V3.1: 恢复计时
  const resumeTiming = () => {
    if (timingStarted && pauseStartRef.current) {
      const pauseDuration = Date.now() - pauseStartRef.current
      pausedDurationRef.current += pauseDuration
      pauseStartRef.current = null
      lastActivityRef.current = Date.now()
      console.log('DictationBox - Timing resumed, paused duration:', pauseDuration)
    }
  }

  // V3.1: 更新活动时间（重置无操作计时器）
  const updateActivity = () => {
    lastActivityRef.current = Date.now()
    startTiming() // 第一次操作时启动计时

    // 清除旧的无操作计时器
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    // 设置新的无操作计时器（60秒）
    inactivityTimerRef.current = setTimeout(() => {
      pauseTiming()
      console.log('DictationBox - Paused due to inactivity (60s)')
    }, 60000)
  }

  // V3.1: 监听浏览器失焦/聚焦事件
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseTiming()
      } else {
        resumeTiming()
        updateActivity() // 重新聚焦时更新活动时间
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timingStarted])

  // V3.1: 计算有效作答时间（秒）
  const calculateEffectiveTime = (): number => {
    if (!startTimeRef.current) return 0

    const endTime = Date.now()
    const rawSeconds = (endTime - startTimeRef.current - pausedDurationRef.current) / 1000

    // 有效性过滤
    // 1. 最小有效时间：< 3 秒不计入
    if (rawSeconds < 3) {
      console.log('DictationBox - Time too short (< 3s):', rawSeconds)
      return 0
    }

    // 2. 最大单句上限：min(180秒, 音频时长 × 5)
    const audioDuration = sentence.endTime - sentence.startTime
    const maxSeconds = Math.min(180, audioDuration * 5)

    // 3. 异常截断
    const effectiveSeconds = Math.min(rawSeconds, maxSeconds)

    console.log('DictationBox - Effective time:', {
      raw: rawSeconds.toFixed(2),
      effective: effectiveSeconds.toFixed(2),
      max: maxSeconds
    })

    return Math.round(effectiveSeconds)
  }

  // Reset when sentence changes
  useEffect(() => {
    setUserInput("")
    setShowResult(false)
    setShowAllWords(false)
    setShowConfirmModal(false)
    setIsRevealed(false)
    setIsLocked(false)
    setShowTranslation(false)  // 重置翻译显示状态
    setWordStatuses(new Map())
    setPeekedWords(new Set()) // Reset peeked words

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
    console.log('DictationBox - Reset for new sentence')
  }, [sentence.id])

  // Update word statuses as user types
  useEffect(() => {
    const userWords = userInput.trim().split(/\s+/)
    const newStatuses = new Map<number, WordStatus>()

    sentenceWords.forEach((word, index) => {
      const userWord = userWords[index]?.toLowerCase().replace(/[^\w\s]/g, "")
      const targetWord = word.toLowerCase().replace(/[^\w\s]/g, "")

      if (!userWord) {
        newStatuses.set(index, "pending")
      } else if (userWord === targetWord) {
        newStatuses.set(index, "correct")
      } else {
        newStatuses.set(index, "incorrect")
      }
    })

    setWordStatuses(newStatuses)

    // V3.1: 用户输入时更新活动时间
    if (userInput.length > 0) {
      updateActivity()
    }
  }, [userInput, sentenceWords])

  const handleCheckAnswer = () => {
    setShowResult(true)
    const isCorrect = checkCorrect()

    // 如果完全正确，播放成功音效
    if (isCorrect) {
      playSuccessSound()
    }

    // V3.1: 计算有效作答时间（秒）
    const durationSeconds = calculateEffectiveTime()

    // 清除无操作计时器
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    if (onComplete) {
      // 传递秒数（不是分钟）
      onComplete(isCorrect, false, durationSeconds)
    }
  }

  const handleShowAllWords = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmShowWords = () => {
    setShowConfirmModal(false)
    setShowAllWords(true)
    setIsRevealed(true)
    setIsLocked(true)

    // Peek all words when Show All Words is clicked
    setPeekedWords(new Set(sentenceWords.map((_, index) => index)))

    // Fill input with correct answer
    setUserInput(sentence.text)

    // Calculate and submit score
    let correctCount = 0
    wordStatuses.forEach((status) => {
      if (status === "correct") {
        correctCount++
      }
    })

    // V3.1: 计算有效作答时间（秒）
    const durationSeconds = calculateEffectiveTime()

    // 清除无操作计时器
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    const isCorrect = correctCount === sentenceWords.length
    if (onComplete) {
      // 传递秒数（不是分钟）
      onComplete(isCorrect, true, durationSeconds) // Used show words
    }
  }

  const handleCancelShowWords = () => {
    setShowConfirmModal(false)
  }

  const handleHideAllWords = () => {
    setShowAllWords(false)
  }

  const handleNext = () => {
    if (onNext && !isLastSentence) {
      onNext()
    }
    setShowResult(false)
    setShowAllWords(false)
    setShowConfirmModal(false)
    setIsRevealed(false)
    setIsLocked(false)
    setUserInput("")
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!showResult && userInput.trim()) {
        handleCheckAnswer()
      } else if (showResult || isRevealed) {
        handleNext()
      }
    }
  }

  // Simple comparison
  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
  }

  const checkCorrect = () => {
    return normalizeText(userInput) === normalizeText(sentence.text)
  }

  const isCorrect = checkCorrect()

  // Calculate missing words count for modal message
  let correctCount = 0
  wordStatuses.forEach((status) => {
    if (status === "correct") {
      correctCount++
    }
  })
  const missingWordsCount = sentenceWords.length - correctCount

  // Handle peek word click
  const handlePeekWord = (index: number) => {
    setPeekedWords(prev => {
      const newSet = new Set(prev)
      newSet.add(index)
      return newSet
    })
  }

  return (
    <div>
      {/* Translation display */}
      {sentence.translation && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          {/* First row: Show translation button */}
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              {showTranslation ? t('practice.dictation.hideTranslation') : t('practice.dictation.showTranslation')}
            </button>
          </div>

          {/* Second row: Translation text */}
          {showTranslation && (
            <p className="text-sm text-gray-600 italic">
              {sentence.translation}
            </p>
          )}
        </div>
      )}

      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('practice.dictation.typeWhatYouHear')}:
      </label>

      {/* Input Area */}
      <div className="relative mb-4">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={updateActivity}
          disabled={isLocked}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder={t('practice.dictation.typeYourAnswer')}
        />
      </div>

      {/* Word Cards Display */}
      <div className="mb-4">
        {/* Show Words Toggle */}
        <div className="flex justify-end mb-2">
          <button
            onClick={showAllWords ? handleHideAllWords : handleShowAllWords}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showAllWords ? t('practice.hideWords') : t('practice.showAllWords')}
          </button>
        </div>

        {/* Word Cards - Always visible when typing or revealed */}
        {(showAllWords || userInput.trim().length > 0) && (
          <div className="flex flex-wrap gap-2">
            {sentenceWords.map((word, index) => {
              const status = wordStatuses.get(index) || "pending"
              const userWords = userInput.trim().split(/\s+/)
              const userWord = userWords[index] || ""
              const isPeeked = peekedWords.has(index)

              // Determine display text and color based on status and showAllWords
              let displayText: string
              let bgClass: string
              let showEyeIcon = false

              if (showAllWords || isRevealed) {
                // Show Words clicked or revealed - reveal all original words
                displayText = word
                bgClass = status === "correct"
                  ? "bg-green-100 border-green-400"
                  : status === "incorrect"
                  ? "bg-red-100 border-red-400"
                  : "bg-gray-100 border-gray-300"
              } else if (isPeeked) {
                // Word is peeked - show original word
                displayText = word
                bgClass = "bg-red-50 border-red-300" // Light red background for peeked words
              } else {
                // Default - show word-by-word status
                if (status === "correct") {
                  // Show original word in green
                  displayText = word
                  bgClass = "bg-green-100 border-green-400"
                } else if (status === "incorrect") {
                  // Show user input + * in red
                  displayText = `${userWord}*`
                  bgClass = "bg-red-100 border-red-400"
                  showEyeIcon = true
                } else {
                  // pending/missing - show asterisks matching word length in gray
                  displayText = "*".repeat(word.split("").length)
                  bgClass = "bg-gray-100 border-gray-300"
                  showEyeIcon = true
                }
              }

              return (
                <div
                  key={index}
                  className="relative"
                >
                  {/* Eye Icon - Show above pending/incorrect words */}
                  {showEyeIcon && !isPeeked && !showAllWords && !isRevealed && (
                    <button
                      onClick={() => handlePeekWord(index)}
                      className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white rounded-full p-1 shadow-sm hover:shadow-md transition-shadow"
                      title="Peek this word"
                    >
                      <Eye className="w-4 h-4 text-blue-500" />
                    </button>
                  )}

                  {/* Word Card */}
                  <div
                    className={`px-3 py-2 rounded-lg border-2 ${bgClass}`}
                  >
                    <span className="text-sm font-medium">
                      {displayText}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Result Display */}
      {showResult && !isCorrect && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-700">
            {t('practice.dictation.incorrect')}
          </p>
        </div>
      )}

      {showResult && isCorrect && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            {t('practice.dictation.correct')}
          </p>
        </div>
      )}

      {/* Check Answer / Next Button */}
      <button
        onClick={showResult || isRevealed ? handleNext : handleCheckAnswer}
        disabled={!showResult && !isRevealed && !userInput.trim()}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {showResult || isRevealed ? (
          <>
            {t('practice.next')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        ) : (
          t('practice.checkAnswer')
        )}
      </button>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={handleCancelShowWords}
        onConfirm={handleConfirmShowWords}
        message={`${t('practice.dictation.showWordsConfirm1')}

${t('practice.dictation.showWordsConfirm2').replace('{count}', String(missingWordsCount))}`}
      />
    </div>
  )
}
