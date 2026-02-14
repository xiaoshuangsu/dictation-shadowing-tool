"use client"

import { useState, useEffect } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
}

interface WordModeProps {
  sentence: Sentence
  onComplete?: (isCorrect: boolean) => void
  currentIndex: number
  totalSentences: number
  onNext?: () => void
  isLastSentence?: boolean
}

type WordStatus = "correct" | "incorrect" | "pending"

export default function WordMode({ sentence, onComplete, currentIndex, totalSentences, onNext, isLastSentence }: WordModeProps) {
  const [userInput, setUserInput] = useState("")
  const [wordIndex, setWordIndex] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const sentenceWords = sentence.text.split(" ")
  const [wordStatuses, setWordStatuses] = useState<Map<number, WordStatus>>(new Map())
  const currentWord = sentenceWords[wordIndex]

  // Reset when sentence changes
  useEffect(() => {
    setUserInput("")
    setWordIndex(0)
    setShowResult(false)
    setWordStatuses(new Map())
  }, [sentence.id])

  // Check if word is correct
  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
  }

  const checkWordCorrect = () => {
    return normalizeText(userInput) === normalizeText(currentWord || "")
  }

  const isCorrect = checkWordCorrect()

  const handleSubmitWord = () => {
    setShowResult(true)

    // Update word status
    const newStatuses = new Map(wordStatuses)
    newStatuses.set(wordIndex, isCorrect ? "correct" : "incorrect")
    setWordStatuses(newStatuses)

    if (onComplete) {
      onComplete(isCorrect)
    }

    // Auto-advance after showing result
    setTimeout(() => {
      if (wordIndex < sentenceWords.length - 1) {
        // Move to next word in current sentence
        setWordIndex(wordIndex + 1)
        setUserInput("")
        setShowResult(false)
      } else {
        // Completed all words in this sentence
        // Auto-advance to next sentence after delay
        setTimeout(() => {
          if (onNext && !isLastSentence) {
            onNext()
          }
        }, 1500)
      }
    }, 1000)
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
      {/* Current Word Indicator */}
      <div className="text-center mb-4">
        <span className="text-sm text-gray-600">Sentence {currentIndex + 1} / {totalSentences}</span>
        <span className="mx-3 text-gray-400">|</span>
        <span className="text-sm text-gray-600">Word {wordIndex + 1} / {sentenceWords.length}</span>
      </div>

      {/* Display Text with Blanks */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-lg leading-relaxed">
          {sentenceWords.map((word, index) => {
            if (index < wordIndex) {
              // Already completed words - show word
              return <span key={index} className="text-green-700 font-semibold">{word} </span>
            } else if (index === wordIndex) {
              // Current word - show blank
              return <span key={index} className="inline-block border-b-2 border-blue-500 px-2 min-w-[80px] text-center text-blue-600 font-medium">[ ______ ]</span>
            } else {
              // Future words - show original word
              return <span key={index} className="text-gray-800">{word} </span>
            }
          })}
        </p>
      </div>

      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Type the word you hear:
      </label>

      {/* Input Area */}
      <div className="relative mb-4">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={showResult}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="Type your answer here..."
        />
      </div>

      {/* Result Display */}
      {showResult && !isCorrect && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">
            Not correct. The answer was: <span className="font-semibold">{currentWord}</span>
          </p>
        </div>
      )}

      {showResult && isCorrect && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            Correct! Moving to next word...
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitWord}
        disabled={!userInput.trim() || showResult}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        Check Word
      </button>

      {/* Hint */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Press Enter to check
      </p>
    </div>
  )
}
