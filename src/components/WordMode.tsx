"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useSuccessSound } from "@/hooks/useSuccessSound"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string  // 可选的中文翻译字段
}

interface WordModeProps {
  sentence: Sentence
  onComplete?: (isCorrect: boolean, usedShowWords?: boolean, durationSeconds?: number) => void
  currentIndex: number
  totalSentences: number
  onNext?: () => void
  isLastSentence?: boolean
}

export default function WordMode({ sentence, onComplete, currentIndex, totalSentences, onNext, isLastSentence }: WordModeProps) {
  const { t } = useLanguage()
  const { playSuccessSound } = useSuccessSound(0.5) // 音量 0.5
  const [userInput, setUserInput] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showWord, setShowWord] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)  // 控制翻译显示状态

  // V3.1 有效作答时间跟踪
  const [timingStarted, setTimingStarted] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const pausedDurationRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  const sentenceWords = sentence.text.split(" ")

  // Randomly select a word to hide (using seeded random based on sentence.id for consistency)
  const { hiddenWordIndex, hiddenWord, visibleWordsBefore, visibleWordsAfter } = useMemo(() => {
    // Use sentence.id as a seed for consistent random selection
    const seed = sentence.id
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
      console.log('WordMode - Timing started')
    }
  }

  // V3.1: 暂停/恢复计时
  const pauseTiming = () => {
    if (timingStarted && !pauseStartRef.current) {
      pauseStartRef.current = Date.now()
      console.log('WordMode - Timing paused')
    }
  }

  const resumeTiming = () => {
    if (timingStarted && pauseStartRef.current) {
      const pauseDuration = Date.now() - pauseStartRef.current
      pausedDurationRef.current += pauseDuration
      pauseStartRef.current = null
      lastActivityRef.current = Date.now()
      console.log('WordMode - Timing resumed')
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
      console.log('WordMode - Paused due to inactivity (60s)')
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
      console.log('WordMode - Time too short (< 3s):', rawSeconds)
      return 0
    }

    const audioDuration = sentence.endTime - sentence.startTime
    const maxSeconds = Math.min(180, audioDuration * 5)
    const effectiveSeconds = Math.min(rawSeconds, maxSeconds)

    console.log('WordMode - Effective time:', {
      raw: rawSeconds.toFixed(2),
      effective: effectiveSeconds.toFixed(2),
      max: maxSeconds
    })

    return Math.round(effectiveSeconds)
  }

  // Reset when sentence changes
  useEffect(() => {
    console.log('WordMode - useEffect triggered for sentence.id:', sentence.id)
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
    console.log('WordMode - Reset complete for sentence.id:', sentence.id)
  }, [sentence.id])

  // Check if word is correct
  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
  }

  const checkWordCorrect = () => {
    return normalizeText(userInput) === normalizeText(hiddenWord || "")
  }

  const handleSubmitWord = () => {
    console.log('WordMode - handleSubmitWord called')
    const correct = checkWordCorrect()
    console.log('WordMode - Correct:', correct, 'Setting showResult to true')
    setShowResult(true)
    setIsCorrect(correct)

    // 如果完全正确，播放成功音效
    if (correct) {
      playSuccessSound()
    }

    // V3.1: 计算有效作答时间（秒）
    const durationSeconds = calculateEffectiveTime()
    console.log('WordMode - Duration:', durationSeconds, 'seconds')

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    if (onComplete) {
      console.log('WordMode - Calling onComplete with:', { correct, durationSeconds })
      onComplete(correct, false, durationSeconds)
      console.log('WordMode - onComplete callback completed')
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
              {showTranslation ? t('practice.dictation.hideTranslation') : t('practice.dictation.showTranslation')}
            </button>
          </div>
        )}

        {/* 第二行：原文 */}
        <p className="text-lg leading-relaxed">
          {visibleWordsBefore.map((word, index) => (
            <span key={index} className="text-gray-800">{word} </span>
          ))}
          <span className="inline-block border-b-2 border-blue-500 px-4 min-w-[100px] text-center text-blue-600 font-medium">[     ]</span>
          {visibleWordsAfter.map((word, index) => (
            <span key={index} className="text-gray-800"> {word}</span>
          ))}
        </p>

        {/* 中文翻译显示 */}
        {showTranslation && sentence.translation && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600 italic">
              {sentence.translation}
            </p>
          </div>
        )}
      </div>

      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('practice.wordMode.typeMissingWord')}:
      </label>

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
          placeholder={showWord ? t('practice.wordMode.correctShown') : t('practice.dictation.typeYourAnswer')}
        />
      </div>

      {/* Result Display */}
      {showResult && isCorrect === false && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 mb-2">
            {t('practice.wordMode.incorrect')}
          </p>
          <button
            onClick={handleShowWord}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
          >
            {t('practice.wordMode.showWord')}
          </button>
        </div>
      )}

      {showResult && isCorrect === true && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            {t('practice.dictation.correct')}
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
            {t('practice.next')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        ) : (
          t('practice.checkAnswer')
        )}
      </button>
    </div>
  )
}
