/**
 * ReviewOverlay - 闪卡拼写训练遮罩层组件
 *
 * 功能：
 * - 全屏遮罩层，用于闪卡训练
 * - 显示单词释义和填空句
 * - 实时校验拼写
 * - 3D 翻转动画展示答案
 * - 查看答案功能（点击或按回车）
 * - 自评功能（Still Learning/Mastered）
 *
 * 训练模式逻辑（挖空拼写）：
 * - 正面：隐藏单词标题，显示填空句（目标词替换为____）
 * - 正面：音标 + US/UK 喇叭辅助拼写
 * - 正面：自动聚焦输入框，用户拼写
 * - 正面：查看答案按钮（输入框为空时按回车）
 * - 背面：显示单词标题，完整原句（高亮目标词）
 * - 背面：自评按钮（Still Learning/Mastered）
 *
 * 修复（V29.7.1）：
 * - 移除内部的 useAuth Hook 调用
 * - 改为通过 props 传递 user
 * - 避免条件渲染导致的 Hook 顺序问题
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Volume2, X } from 'lucide-react'
import { AuthUser } from '@/lib/hooks/useAuth'
import logger from '@/lib/utils/logger'

interface ReviewWord {
  id: string
  word: string
  phonetic: string
  pos?: string
  definition: string
  context_sentence: string
  audio_url_us?: string
  audio_url_uk?: string
}

interface ReviewOverlayProps {
  words: ReviewWord[]
  user: AuthUser | null
  onClose: () => void
}

const parseDefinition = (definitionStr: string) => {
  try {
    return JSON.parse(definitionStr)
  } catch {
    return {
      'zh-CN': definitionStr || '',
      'zh-Hant': '',
      'vi': '',
      'en': definitionStr || ''
    }
  }
}

export default function ReviewOverlay({ words, user, onClose }: ReviewOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [isCorrect, setIsCorrect] = useState(false | null)
  const [showedAnswer, setShowedAnswer] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentWord = words[currentIndex]
  const isLastCard = currentIndex === words.length - 1

  const definition = parseDefinition(currentWord.definition)
  const chineseDefinition = definition['zh-CN'] || ''
  const englishDefinition = definition['en'] || ''

  useEffect(() => {
    if (!flipped && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, flipped])

  useEffect(() => {
    setShowedAnswer(false)
  }, [currentIndex])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUserInput(value)

    const normalizedInput = value.toLowerCase().trim()
    const normalizedWord = currentWord.word.toLowerCase()

    if (normalizedInput === normalizedWord) {
      setIsCorrect(true)
      setTimeout(() => {
        setFlipped(true)
      }, 300)
    } else {
      setIsCorrect(false)
      if (value.length > 0 && value.length >= normalizedWord.length) {
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 500)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !flipped) {
      if (isCorrect) {
        setFlipped(true)
      } else if (userInput.trim() === '') {
        handleShowAnswer()
      }
    }
  }

  const handleShowAnswer = () => {
    setShowedAnswer(true)
    setFlipped(true)
  }

  const handleNext = async (masteryStatus?: 'learning' | 'familiar' | 'mastered') => {
    if (masteryStatus && user?.id) {
      logger.debug(`[ReviewOverlay] 更新单词 "${currentWord.word}" (ID: ${currentWord.id}) 掌握状态为: ${masteryStatus}`)

      try {
        const response = await fetch('/api/user-words', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`
          },
          body: JSON.stringify({
            wordId: currentWord.id,
            masteryStatus: masteryStatus
          })
        })

        if (response.ok) {
          const result = await response.json()
          logger.debug(`[ReviewOverlay] ✅ 成功更新单词状态:`, result)
        } else {
          const errorData = await response.json()
          console.error('[ReviewOverlay] ❌ 更新单词状态失败:', errorData)
        }
      } catch (error) {
        console.error('[ReviewOverlay] 更新单词状态出错:', error)
      }
    }

    if (isLastCard) {
      onClose()
      return
    }

    setCurrentIndex(prev => prev + 1)
    setFlipped(false)
    setUserInput('')
    setIsCorrect(null)
    setShowedAnswer(false)
  }

  const createBlankSentence = (sentence: string, word: string) => {
    const lowerWord = word.toLowerCase().trim()

    let processed = sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), (match) => {
      return `<span class="font-bold text-blue-600 border-b-2 border-blue-600 bg-blue-50 px-1 rounded">${'_____'}</span>`
    })

    if (!processed.includes('<span')) {
      const pattern = new RegExp(`\\b\\w*${lowerWord}\\w*\\b`, 'gi')
      processed = sentence.replace(pattern, (match) => {
        return `<span class="font-bold text-blue-600 border-b-2 border-blue-600 bg-blue-50 px-1 rounded">${'_____'}</span>`
      })
    }

    return processed
  }

  const createHighlightSentence = (sentence: string, word: string) => {
    const lowerWord = word.toLowerCase().trim()

    let processed = sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), (match) => {
      return `<span class="font-bold text-yellow-300 bg-yellow-500/30 px-1 rounded">${match}</span>`
    })

    if (!processed.includes('<span')) {
      const pattern = new RegExp(`\\b\\w*${lowerWord}\\w*\\b`, 'gi')
      processed = sentence.replace(pattern, (match) => {
        return `<span class="font-bold text-yellow-300 bg-yellow-500/30 px-1 rounded">${match}</span>`
      })
    }

    return processed
  }

  const playAudio = (variant: 'us' | 'uk') => {
    const audioUrl = variant === 'us' ? currentWord.audio_url_us : currentWord.audio_url_uk
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play().catch(err => console.error('播放失败:', err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="w-full max-w-2xl">
        <div className="text-center text-white mb-4">
          <span className="text-lg font-semibold">
            {currentIndex + 1} / {words.length}
          </span>
        </div>

        <div
          className={`relative w-full h-[520px] perspective-1000 ${
            flipped ? 'flipped' : ''
          }`}
          style={{ perspective: '1000px' }}
        >
          <div
            className="relative w-full h-full transition-transform duration-700 transform-style-3d"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            <div
              className={`absolute w-full h-full bg-white rounded-2xl p-6 flex flex-col justify-between transition-shadow duration-300 ${
                isCorrect ? 'shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 'shadow-2xl'
              }`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div>
                {currentWord.pos && (
                  <div className="text-center mb-3">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">
                      {currentWord.pos}
                    </span>
                  </div>
                )}

                <div className="text-center">
                  {chineseDefinition && (
                    <p className="text-[22px] font-bold text-gray-900 text-center mb-2">
                      {chineseDefinition}
                    </p>
                  )}
                  {englishDefinition && (
                    <p className="text-base text-gray-400 text-center">
                      {englishDefinition}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100/50 my-4">
                <p
                  className="text-base text-gray-700 leading-relaxed text-center"
                  dangerouslySetInnerHTML={{
                    __html: createBlankSentence(currentWord.context_sentence, currentWord.word)
                  }}
                />
              </div>

              <div className="flex items-center justify-center gap-3 mb-4">
                {currentWord.phonetic && (
                  <p className="text-base text-gray-600 font-medium">
                    {currentWord.phonetic}
                  </p>
                )}

                {currentWord.phonetic && (currentWord.audio_url_us || currentWord.audio_url_uk) && (
                  <div className="w-px h-5 bg-gray-200"></div>
                )}

                {currentWord.audio_url_us && (
                  <button
                    onClick={() => playAudio('us')}
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
                    title="US pronunciation"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>US</span>
                  </button>
                )}

                {currentWord.audio_url_us && currentWord.audio_url_uk && (
                  <div className="w-px h-5 bg-gray-200"></div>
                )}

                {currentWord.audio_url_uk && (
                  <button
                    onClick={() => playAudio('uk')}
                    className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 transition-colors text-sm font-medium"
                    title="UK pronunciation"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>UK</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type the word..."
                  className={`w-full px-6 py-4 text-xl text-center border-2 rounded-xl transition-all ${
                    isShaking ? 'animate-shake' : ''
                  } ${
                    isCorrect === true
                      ? 'border-green-500 bg-green-50 text-green-900 shadow-sm'
                      : isCorrect === false
                      ? 'border-red-300 bg-red-50 text-red-900'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:shadow-sm'
                  }`}
                  disabled={flipped}
                  autoComplete="off"
                />

                {!flipped && userInput.length > 0 && (
                  <p className="text-center text-sm">
                    {isCorrect === true ? (
                      <span className="text-green-600 font-semibold">✓ Correct! Flipping...</span>
                    ) : isCorrect === false ? (
                      <span className="text-red-500">Keep trying...</span>
                    ) : null}
                  </p>
                )}

                {!flipped && !isCorrect && (
                  <button
                    onClick={handleShowAnswer}
                    className="w-full text-center text-sm text-gray-400 hover:text-blue-600 transition-colors py-2 font-medium"
                  >
                    Show Answer
                  </button>
                )}
              </div>
            </div>

            <div
              className="absolute w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-8 flex flex-col text-white"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <div className="flex-1 flex flex-col items-center justify-center mb-6">
                <h2 className="text-5xl font-bold mb-4">{currentWord.word}</h2>
                {currentWord.phonetic && (
                  <p className="text-xl text-blue-100">{currentWord.phonetic}</p>
                )}
              </div>

              {currentWord.context_sentence && (
                <div className="bg-white/10 rounded-lg p-4 mb-8 backdrop-blur-sm">
                  <p
                    className="text-base text-white/90 text-center leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: createHighlightSentence(currentWord.context_sentence, currentWord.word)
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-6 mb-8">
                <button
                  onClick={() => playAudio('us')}
                  className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  disabled={!currentWord.audio_url_us}
                >
                  <Volume2 className="w-5 h-5" />
                  <span className="font-semibold">US</span>
                </button>
                <button
                  onClick={() => playAudio('uk')}
                  className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  disabled={!currentWord.audio_url_uk}
                >
                  <Volume2 className="w-5 h-5" />
                  <span className="font-semibold">UK</span>
                </button>
              </div>

              {isCorrect || showedAnswer ? (
                <div className="space-y-3 md:space-y-4">
                  <p className="text-center text-sm md:text-base text-white/90 font-medium">
                    {isCorrect ? 'Great job! You nailed it! 😊' : 'Keep practicing! 💪'}
                  </p>

                  <div className="flex flex-row md:flex-row gap-1.5 md:gap-3">
                    <button
                      onClick={() => handleNext('learning')}
                      className="flex-1 px-2 py-2 md:px-5 md:py-4 bg-red-500 text-white rounded-lg md:rounded-xl font-bold text-xs md:text-base hover:bg-red-600 transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="flex flex-col items-center gap-0.5 md:gap-1">
                        <span className="hidden md:inline text-lg">😵</span>
                        <span className="font-semibold">Still Learning</span>
                        <span className="text-[10px] md:text-xs font-normal opacity-80">review in 1h</span>
                        <span className="hidden md:inline text-xs font-normal opacity-80">Review in 1 hour</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNext('familiar')}
                      className="flex-1 px-2 py-2 md:px-5 md:py-4 bg-yellow-500 text-white rounded-lg md:rounded-xl font-bold text-xs md:text-base hover:bg-yellow-600 transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="flex flex-col items-center gap-0.5 md:gap-1">
                        <span className="hidden md:inline text-lg">🤔</span>
                        <span className="font-semibold">Kinda Know</span>
                        <span className="text-[10px] md:text-xs font-normal opacity-80">review in 1d</span>
                        <span className="hidden md:inline text-xs font-normal opacity-80">Review in 1 day</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleNext('mastered')}
                      className="flex-1 px-2 py-2 md:px-5 md:py-4 bg-green-500 text-white rounded-lg md:rounded-xl font-bold text-xs md:text-base hover:bg-green-600 transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      <div className="flex flex-col items-center gap-0.5 md:gap-1">
                        <span className="hidden md:inline text-lg">😎</span>
                        <span className="font-semibold">Too Easy</span>
                        <span className="text-[10px] md:text-xs font-normal opacity-80">review in 7d</span>
                        <span className="hidden md:inline text-xs font-normal opacity-80">Review in 7 days</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleNext()}
                  className="w-full px-8 py-4 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors text-lg"
                >
                  {isLastCard ? 'Finish' : 'Next →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
