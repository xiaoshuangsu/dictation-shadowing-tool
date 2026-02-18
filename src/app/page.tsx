"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AudioPlayer from "@/components/AudioPlayer"
import DictationBox from "@/components/DictationBox"
import ShadowingPanel from "@/components/ShadowingPanel"
import WordMode from "@/components/WordMode"
import AuthButton from "@/components/auth/AuthButton"
import { useAuth } from "@/lib/hooks/useAuth"
import { savePracticeRecord } from "@/lib/supabase/client"
import { onDictationComplete, onShadowingComplete } from "@/lib/supabase/streak"

// Audio Title
const AUDIO_TITLE = "First Snowfall"

// Audio file URL
const AUDIO_SRC = "/dictation-shadowing-tool/learn-english-via-listening-1001.mp3"

// Sentence data with precise timestamps (auto-transcribed with Whisper)
const sampleSentences = [
  { id: 1, text: "First snowfall.", startTime: 0.0, endTime: 1.6 },
  { id: 2, text: "Today is November 26th.", startTime: 3.6, endTime: 5.6 },
  { id: 3, text: "It snowed all day today.", startTime: 6.3, endTime: 7.8 },
  { id: 4, text: "The snow is beautiful.", startTime: 8.8, endTime: 10.4 },
  { id: 5, text: "The snow finally stopped.", startTime: 11.5, endTime: 13.2 },
  { id: 6, text: "My sister and I are excited.", startTime: 14.9, endTime: 16.6 },
  { id: 7, text: "My mom doesn't like the snow.", startTime: 17.6, endTime: 19.5 },
  { id: 8, text: "My mom has to shovel the driveway.", startTime: 20.5, endTime: 22.6 },
  { id: 9, text: "My sister and I get to play.", startTime: 23.7, endTime: 25.6 },
  { id: 10, text: "I put on my hat and mittens.", startTime: 26.7, endTime: 28.9 },
  { id: 11, text: "My mom puts on my scarf.", startTime: 29.7, endTime: 31.3 },
  { id: 12, text: "My mom zippers my jacket.", startTime: 32.4, endTime: 34.2 },
  { id: 13, text: "My sister puts on her hat and mittens.", startTime: 35.1, endTime: 37.7 },
  { id: 14, text: "My mom puts on her scarf.", startTime: 38.6, endTime: 40.5 },
  { id: 15, text: "My mom zippers her jacket.", startTime: 41.7, endTime: 43.5 },
  { id: 16, text: "My sister and I go outside.", startTime: 44.7, endTime: 46.6 },
  { id: 17, text: "We begin to make a snowman.", startTime: 47.3, endTime: 49.5 },
  { id: 18, text: "My mom starts to shovel the snow.", startTime: 50.4, endTime: 52.6 },
  { id: 19, text: "My sister and I make snow angels.", startTime: 53.7, endTime: 55.7 },
  { id: 20, text: "My sister and I throw snowballs.", startTime: 56.7, endTime: 58.7 },
  { id: 21, text: "It starts to snow again.", startTime: 59.4, endTime: 61.4 },
  { id: 22, text: "We go inside for hot chocolate.", startTime: 62.2, endTime: 64.5 },
]

type PracticeMode = "dictation" | "shadowing"
type DictationMode = "word" | "whole"

export default function Home() {
  const { user, loading: authLoading } = useAuth()

  // Debug: Log user state
  useEffect(() => {
    console.log('Home page - Auth state:', {
      loading: authLoading,
      user: user ? { id: user.id, username: user.username } : null,
      isAuthenticated: !!user,
    })
  }, [authLoading, user])
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
  const [mode, setMode] = useState<PracticeMode>("dictation")
  const [dictationMode, setDictationMode] = useState<DictationMode>("word")
  const [correctCount, setCorrectCount] = useState(0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false) // Track if user used "Show Words"
  const [showSignupPrompt, setShowSignupPrompt] = useState(false) // 注册提醒弹窗

  const currentSentence = sampleSentences[currentSentenceIndex]

  // Show signup prompt for non-logged in users
  useEffect(() => {
    // Only show prompt if auth is initialized, user is not logged in, and hasn't dismissed
    if (!authLoading && !user) {
      const hasDismissed = localStorage.getItem('signupPromptDismissed')
      if (!hasDismissed) {
        // Delay showing the prompt to ensure user sees the page first
        const timer = setTimeout(() => {
          setShowSignupPrompt(true)
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
    // Hide prompt if user logs in
    if (user) {
      setShowSignupPrompt(false)
    }
  }, [authLoading, user])

  // Auto-play when sentence index changes
  useEffect(() => {
    if (currentSentenceIndex > 0) {
      setAutoPlayTrigger(prev => prev + 1)
    }
  }, [currentSentenceIndex])

  const handleNext = () => {
    if (currentSentenceIndex < sampleSentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(currentSentenceIndex - 1)
    }
  }

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time)
  }

  const handleComplete = async (
    sentenceId: number,
    isCorrect: boolean,
    usedShowWords: boolean = false,
    duration?: number // Dictation: minutes, Shadowing: seconds
  ) => {
    // Update local state (existing logic)
    const newCompleted = new Set(completedSentences)
    newCompleted.add(sentenceId)
    setCompletedSentences(newCompleted)
    if (isCorrect) {
      setCorrectCount(correctCount + 1)
      const newCorrectSet = new Set(correctSentences)
      newCorrectSet.add(sentenceId)
      setCorrectSentences(newCorrectSet)
    } else {
      setIncorrectSentences(new Set(incorrectSentences))
      const newIncorrectSet = new Set(incorrectSentences)
      newIncorrectSet.add(sentenceId)
      setIncorrectSentences(newIncorrectSet)
    }

    // Save to Supabase if user is logged in
    if (user) {
      try {
        // V3 数据留存：保存到 practice_records
        await savePracticeRecord({
          userId: user.id,
          sentenceId,
          sentenceText: currentSentence.text,
          practiceMode: mode,
          dictationMode: mode === 'dictation' ? dictationMode : undefined,
          isCorrect,
          usedShowWords,
          audioTitle: AUDIO_TITLE,
          durationSeconds: mode === 'shadowing' ? (duration || 0) : undefined, // Shadowing 保存秒数
        })

        // V3 数据留存：更新连胜和统计数据
        if (mode === 'dictation') {
          // Dictation: 传递分钟数
          const minutes = duration || 0
          console.log('handleComplete - Calling onDictationComplete with minutes:', minutes)
          await onDictationComplete(user.id, minutes)
        } else if (mode === 'shadowing') {
          // Shadowing: 传递秒数（转换为分钟）
          const seconds = duration || 0
          const minutes = seconds / 60
          console.log('handleComplete - Calling onShadowingComplete with seconds:', seconds, 'minutes:', minutes)
          await onShadowingComplete(user.id, minutes)
        }

        console.log(`Practice data saved (${mode}, duration: ${duration})`)
      } catch (error) {
        console.error('Failed to save practice data:', error)
        // Don't show error to user - practice continues normally
      }
    }

    // Reset the revealed state for next sentence
    setIsRevealed(false)
  }

  const handleSentenceClick = (index: number) => {
    setCurrentSentenceIndex(index)
    setAutoPlayTrigger(prev => prev + 1)
  }

  // Calculate which words should be highlighted based on current playback time
  const getHighlightedWordIndex = (sentence: typeof sampleSentences[0]) => {
    if (currentTime < sentence.startTime || currentTime > sentence.endTime) {
      return -1 // Not playing this sentence
    }

    const progress = (currentTime - sentence.startTime) / (sentence.endTime - sentence.startTime)
    const words = sentence.text.split(' ')
    const highlightedIndex = Math.floor(progress * words.length)
    return Math.min(highlightedIndex, words.length - 1)
  }

  const isLastSentence = currentSentenceIndex === sampleSentences.length - 1
  const isFirstSentence = currentSentenceIndex === 0

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">{AUDIO_TITLE}</h1>
          <AuthButton />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-600">
            Correct: {correctCount} / {sampleSentences.length}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => {
                setMode("dictation")
                setCurrentSentenceIndex(0)
                setCompletedSentences(new Set())
                setCorrectSentences(new Set())
                setIncorrectSentences(new Set())
                setCorrectCount(0)
                setShowTranscript(false)
                setIsRevealed(false)
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "dictation"
                  ? "bg-blue-500 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Dictation
            </button>
            <button
              onClick={() => {
                setMode("shadowing")
                setCurrentSentenceIndex(0)
                setCompletedSentences(new Set())
                setCorrectSentences(new Set())
                setIncorrectSentences(new Set())
                setCorrectCount(0)
                setShowTranscript(false)
                setIsRevealed(false)
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "shadowing"
                  ? "bg-blue-500 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Shadowing
            </button>
          </div>
        </div>

        {/* Dictation Mode Sub-toggle (only show in Dictation mode) */}
        {mode === "dictation" && (
          <div className="flex justify-start mb-4 items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Dictation mode:
            </span>
            <div className="relative">
              <select
                value={dictationMode}
                onChange={(e) => {
                  const newMode = e.target.value as "word" | "whole"
                  setDictationMode(newMode)
                  setCurrentSentenceIndex(0)
                  setCompletedSentences(new Set())
                  setCorrectSentences(new Set())
                  setIncorrectSentences(new Set())
                  setCorrectCount(0)
                  setIsRevealed(false)
                }}
                className="appearance-none pr-8 pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="word">Word</option>
                <option value="whole">Whole Caption</option>
              </select>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          {/* Progress */}
          <div className="text-center mb-4 text-sm text-gray-600">
            {currentSentenceIndex + 1} / {sampleSentences.length}
          </div>

          {/* Top Control Bar */}
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              {/* Navigation Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevious}
                  disabled={isFirstSentence}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <AudioPlayer
                  audioSrc={AUDIO_SRC}
                  currentSentence={currentSentence}
                  playbackRate={playbackRate}
                  autoPlayTrigger={autoPlayTrigger}
                  onPlayEnd={() => {}}
                  onTimeUpdate={handleTimeUpdate}
                />

                <button
                  onClick={handleNext}
                  disabled={isLastSentence}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Speed:</span>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-sm bg-white"
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="1.75">1.75x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>
          </div>

          {/* Practice Area */}
          {mode === "dictation" ? (
            dictationMode === "word" ? (
              <WordMode
                sentence={currentSentence}
                onComplete={(isCorrect, usedShowWords, minutes) => handleComplete(currentSentence.id, isCorrect, usedShowWords, minutes)}
                currentIndex={currentSentenceIndex}
                totalSentences={sampleSentences.length}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            ) : (
              <DictationBox
                sentence={currentSentence}
                onComplete={(isCorrect, usedShowWords, minutes) => handleComplete(currentSentence.id, isCorrect, usedShowWords, minutes)}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            )
          ) : (
            <ShadowingPanel
              sentence={currentSentence}
              onComplete={(isCorrect, minutes) => handleComplete(currentSentence.id, isCorrect, false, minutes)}
              onNext={handleNext}
              isLastSentence={isLastSentence}
            />
          )}
        </div>

        {/* Show Transcript Button */}
        <div className="text-center">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </button>
        </div>

        {/* Transcript Section */}
        {showTranscript && (
          <div className="mt-4 bg-white rounded-lg shadow-sm p-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Transcript</h3>
            <div className="space-y-3">
              {sampleSentences.map((sentence, index) => {
                const isCompleted = completedSentences.has(sentence.id)
                const isCorrect = correctSentences.has(sentence.id)
                const isIncorrect = incorrectSentences.has(sentence.id)

                return (
                  <div
                    key={sentence.id}
                    onClick={() => handleSentenceClick(index)}
                    className={`border rounded-lg p-3 relative cursor-pointer hover:bg-blue-100 transition-colors ${
                      index === currentSentenceIndex
                        ? "bg-blue-50 border-2 border-blue-500"
                        : isCompleted
                        ? "border-green-500 bg-green-50"
                        : "border-blue-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      {/* Sentence Number */}
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-blue-200 text-blue-700"
                        }`}>
                          {index + 1}
                        </span>
                      </div>

                      {/* Sentence Content - Always show text in transcript with word-level highlighting */}
                      <div className="flex-1">
                        <p className={`text-sm ${
                          mode === "shadowing"
                            ? isCorrect
                              ? "text-green-800"
                              : isIncorrect
                              ? "text-orange-800"
                              : "text-gray-800"
                            : "text-gray-800"
                        }`}>
                          {sentence.text.split(' ').map((word, wordIndex) => {
                            const highlightedWordIndex = index === currentSentenceIndex ? getHighlightedWordIndex(sentence) : -1
                            const isHighlighted = wordIndex <= highlightedWordIndex
                            const isCurrentWord = wordIndex === highlightedWordIndex

                            return (
                              <span
                                key={wordIndex}
                                className={
                                  isCurrentWord
                                    ? "bg-yellow-300 rounded px-1 font-semibold"
                                    : isHighlighted && index === currentSentenceIndex
                                    ? "bg-yellow-100 rounded px-1"
                                    : ""
                                }
                              >
                                {word}{' '}
                              </span>
                            )
                          })}
                        </p>
                      </div>

                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {mode === "shadowing" ? (
                          // Shadowing: 显示正确性图标
                          isCorrect ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : isIncorrect ? (
                            <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : null
                        ) : (
                          // Dictation: 已完成显示勾
                          isCompleted ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : null
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Completion Message */}
        {completedSentences.size === sampleSentences.length && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-700 font-medium">
              🎉 Congratulations! You've completed all sentences! Accuracy: {Math.round((correctCount / sampleSentences.length) * 100)}%
            </p>
          </div>
        )}
      </div>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              解锁您的学习进度
            </h2>

            <p className="text-gray-600 mb-6">
              注册账号即可保存练习记录，追踪学习进度，查看详细统计数据。
            </p>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">自动保存练习记录</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">查看详细统计数据</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">追踪学习进度</span>
              </li>
            </ul>

            <div className="flex gap-3 mb-4">
              <Link
                href="/register"
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
              >
                免费注册
              </Link>
              <Link
                href="/login"
                className="flex-1 py-3 px-4 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                登录
              </Link>
            </div>

            <button
              onClick={() => {
                setShowSignupPrompt(false)
                localStorage.setItem('signupPromptDismissed', 'true')
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              暂不注册，继续练习
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
