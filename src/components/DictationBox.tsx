"use client"

import { useState, useEffect } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
}

interface DictationBoxProps {
  sentence: Sentence
  onComplete?: (isCorrect: boolean) => void
  onNext?: () => void
  isLastSentence?: boolean
}

type WordStatus = "correct" | "incorrect" | "pending"

export default function DictationBox({ sentence, onComplete, onNext, isLastSentence }: DictationBoxProps) {
  const [userInput, setUserInput] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [showAllWords, setShowAllWords] = useState(false)

  // Word-level state
  const sentenceWords = sentence.text.split(" ")
  const [wordStatuses, setWordStatuses] = useState<Map<number, WordStatus>>(new Map())

  // Reset when sentence changes
  useEffect(() => {
    setUserInput("")
    setShowResult(false)
    setShowAllWords(false)
    setWordStatuses(new Map())
  }, [sentence.id])

  // Update word statuses as user types
  useEffect(() => {
    const userWords = userInput.trim().split(/\s+/)
    const newStatuses = new Map<number, WordStatus>()

    sentenceWords.forEach((word, index) => {
      const userWord = userWords[index]?.toLowerCase().replace(/[^\w]/g, "")
      const targetWord = word.toLowerCase().replace(/[^\w]/g, "")

      if (!userWord) {
        newStatuses.set(index, "pending")
      } else if (userWord === targetWord) {
        newStatuses.set(index, "correct")
      } else {
        newStatuses.set(index, "incorrect")
      }
    })

    setWordStatuses(newStatuses)
  }, [userInput, sentenceWords])

  const handleCheckAnswer = () => {
    setShowResult(true)
    const isCorrect = checkCorrect()
    if (onComplete) {
      onComplete(isCorrect)
    }
  }

  const handleShowAllWords = () => {
    setShowAllWords(true)

    // Mark all incorrect words as errors in parent
    let correctCount = 0
    wordStatuses.forEach((status) => {
      if (status === "correct") {
        correctCount++
      }
    })

    const isCorrect = correctCount === sentenceWords.length
    if (onComplete) {
      onComplete(isCorrect)
    }
  }

  const handleNext = () => {
    if (onNext && !isLastSentence) {
      onNext()
    }
    setShowResult(false)
    setShowAllWords(false)
    setUserInput("")
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!showResult && userInput.trim()) {
        handleCheckAnswer()
      } else if (showResult) {
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

  return (
    <div>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Type what you hear:
      </label>

      {/* Input Area */}
      <div className="relative mb-4">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-base"
          placeholder="Type your answer here..."
        />
      </div>

      {/* Word Cards Display */}
      <div className="mb-4">
        {/* Show Words Toggle */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => showAllWords ? setShowAllWords(false) : setShowAllWords(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showAllWords ? "Hide Words" : "Show Words"}
          </button>
        </div>

        {/* Word Cards - Always visible when typing or revealed */}
        {(showAllWords || userInput.trim().length > 0) && (
          <div className="flex flex-wrap gap-2">
            {sentenceWords.map((word, index) => {
              const status = wordStatuses.get(index) || "pending"
              const userWords = userInput.trim().split(/\s+/)
              const userWord = userWords[index] || ""

              // Determine display text and color based on status and showAllWords
              let displayText: string
              let bgClass: string

              if (showAllWords) {
                // Show Words clicked - reveal all original words
                displayText = word
                bgClass = status === "correct"
                  ? "bg-green-100 border-green-400"
                  : status === "incorrect"
                  ? "bg-red-100 border-red-400"
                  : "bg-gray-100 border-gray-300"
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
                } else {
                  // pending/missing - show asterisks matching word length in gray
                  displayText = "*".repeat(word.split("").length)
                  bgClass = "bg-gray-100 border-gray-300"
                }
              }

              return (
                <div
                  key={index}
                  className={`px-3 py-2 rounded-lg border-2 ${bgClass}`}
                >
                  <span className="text-sm font-medium">
                    {displayText}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Result Display */}
      {showResult && !isCorrect && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">
            Not correct. Please try again.
          </p>
        </div>
      )}

      {showResult && isCorrect && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            ✓ Correct!
          </p>
        </div>
      )}

      {/* Check Answer / Next Button */}
      <button
        onClick={showResult ? handleNext : handleCheckAnswer}
        disabled={!showResult && !userInput.trim()}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {showResult ? (
          <>
            Next
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </>
        ) : (
          "Check Answer"
        )}
      </button>

      {/* Hint */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Press Enter to {showResult ? "continue" : "check"}
      </p>
    </div>
  )
}
