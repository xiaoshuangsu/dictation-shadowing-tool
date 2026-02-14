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

export default function WordMode({ sentence, onComplete, currentIndex, totalSentences, onNext, isLastSentence }: WordModeProps) {
  const [userInput, setUserInput] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const sentenceWords = sentence.text.split(" ")
  
  // Hide the last word
  const hiddenWordIndex = sentenceWords.length - 1
  const hiddenWord = sentenceWords[hiddenWordIndex]
  const visibleWords = sentenceWords.slice(0, hiddenWordIndex)

  // Reset when sentence changes
  useEffect(() => {
    setUserInput("")
    setShowResult(false)
    setIsCorrect(null)
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

    if (onComplete) {
      onComplete(correct)
    }

    // Only advance if correct
    if (correct) {
      setTimeout(() => {
        if (onNext && !isLastSentence) {
          onNext()
        }
      }, 1500)
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!showResult && userInput.trim()) {
        handleSubmitWord()
      } else if (showResult) {
        // Allow editing again
        setShowResult(false)
        setIsCorrect(null)
      }
    }
  }

  return (
    <div>
      {/* Current Sentence Indicator */}
      <div className="text-center mb-4">
        <span className="text-sm text-gray-600">Sentence {currentIndex + 1} / {totalSentences}</span>
      </div>

      {/* Display Text with One Hidden Word */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-lg leading-relaxed">
          {visibleWords.map((word, index) => (
            <span key={index} className="text-gray-800">{word} </span>
          ))}
          <span className="inline-block border-b-2 border-blue-500 px-4 min-w-[100px] text-center text-blue-600 font-medium">[     ]</span>
        </p>
      </div>

      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Type the missing word:
      </label>

      {/* Input Area */}
      <div className="relative mb-4">
        <textarea
          value={userInput}
          onChange={(e) => {
            setUserInput(e.target.value)
            // Allow editing again by clearing result
            if (showResult) {
              setShowResult(false)
              setIsCorrect(null)
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-base"
          placeholder="Type your answer here..."
        />
      </div>

      {/* Result Display */}
      {showResult && isCorrect === false && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">
            Not correct. Please listen again and try!
          </p>
        </div>
      )}

      {showResult && isCorrect === true && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            Correct!
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitWord}
        disabled={!userInput.trim()}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Check Answer
      </button>

      {/* Hint */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Press Enter to check
      </p>
    </div>
  )
}
