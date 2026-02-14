"use client"

import { useState, useEffect, useRef } from "react"
import AudioPlayer from "@/components/AudioPlayer"
import DictationBox from "@/components/DictationBox"
import ShadowingPanel from "@/components/ShadowingPanel"
import WordMode from "@/components/WordMode"

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

  const currentSentence = sampleSentences[currentSentenceIndex]

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

  const handleComplete = (sentenceId: number, isCorrect: boolean) => {
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
  }

  const isLastSentence = currentSentenceIndex === sampleSentences.length - 1
  const isFirstSentence = currentSentenceIndex === 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{AUDIO_TITLE}</h1>
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
                onComplete={(isCorrect) => handleComplete(currentSentence.id, isCorrect)}
                currentIndex={currentSentenceIndex}
                totalSentences={sampleSentences.length}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            ) : (
              <DictationBox
                sentence={currentSentence}
                onComplete={(isCorrect) => handleComplete(currentSentence.id, isCorrect)}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            )
          ) : (
            <ShadowingPanel
              sentence={currentSentence}
              onComplete={(isCorrect) => handleComplete(currentSentence.id, isCorrect)}
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
                    className={`border rounded-lg p-3 relative ${
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

                      {/* Sentence Content - Dictation uses asterisks, Shadowing always shows text */}
                      <div className="flex-1">
                        {mode === "shadowing" ? (
                          // Shadowing: 始终显示原文，根据正确性着色
                          <p className={`text-sm ${
                            isCorrect
                              ? "text-green-800"
                              : isIncorrect
                              ? "text-orange-800"
                              : "text-gray-800"
                          }`}>
                            {sentence.text}
                          </p>
                        ) : (
                          // Dictation: 已完成显示原文，未完成显示星号
                          isCompleted ? (
                            <p className="text-sm text-gray-800">{sentence.text}</p>
                          ) : (
                            <p className="text-sm text-gray-400">
                              {"* ".repeat(sentence.text.split(" ").length)}
                            </p>
                          )
                        )}
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
    </main>
  )
}
