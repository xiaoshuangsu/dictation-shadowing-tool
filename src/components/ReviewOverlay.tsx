/**
 * ReviewOverlay - 闪卡拼写训练遮罩层组件
 *
 * V2.0 - 同步最新单词卡片逻辑
 * - 双层释义：英文释义 + 目标语翻译
 * - 双例句：词典标准例句 + 素材实战原句
 * - 智能音频路由：R2 优先 + Web Speech API 兜底
 * - 素材跳转：使用修复后的英文 Slug 路径
 *
 * 功能：
 * - 全屏遮罩层，用于闪卡训练
 * - 显示单词释义和填空句
 * - 实时校验拼写
 * - 3D 翻转动画展示答案
 * - 查看答案功能（点击或按回车）
 * - 自评功能（Still Learning/Kinda Know/Too Easy）
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Volume2, X, ExternalLink } from 'lucide-react'
import { AuthUser } from '@/lib/hooks/useAuth'
import { categoryToSlug } from '@/lib/utils/category'
import logger from '@/lib/utils/logger'

interface ReviewWord {
  id: string
  word: string
  phonetic: string
  definition: string
  context_sentence?: string
  audio_url_us?: string
  audio_url_uk?: string
  // 新增字段
  dictionary_cache?: {
    example?: string
    audio_url_us?: string | null
    audio_url_uk?: string | null
  }
  material_info?: {
    category: string
    slug: string
    transcript?: any[] | null
  }
  audio_timestamp?: number | null
  material_title?: string
}

interface ReviewOverlayProps {
  words: ReviewWord[]
  user: AuthUser | null
  onClose: () => void
}

// 翻译解析
const parseDefinition = (definitionStr: string) => {
  try {
    const parsed = JSON.parse(definitionStr)
    if (parsed.zh || parsed.en || parsed.vi) {
      return parsed
    }
    if (parsed['zh-CN'] || parsed['zh-Hant']) {
      return {
        zh: parsed['zh-CN'] || '',
        en: parsed.en || '',
        vi: parsed.vi || ''
      }
    }
    return { zh: definitionStr }
  } catch {
    return { zh: definitionStr }
  }
}

// 获取英文释义
const getEnglishDefinition = (definitionStr: string) => {
  const parsed = parseDefinition(definitionStr)
  return parsed.en || ''
}

// 判断是否为 R2 音频
const isR2AudioUrl = (url?: string | null) => {
  if (!url || url.trim() === '' || url === 'null') return false
  if (url.includes('translate.google.com') || url.includes('translate_tts')) return false
  return url.includes('.mp3') || url.includes('.wav') || url.includes('.m4a') ||
         url.includes('audio/') || url.includes('media.') || url.includes('r2.')
}

// 获取原句（通过 timestamp 查找）
const getOriginalSentence = (transcript: any[] | null, timestamp: number | null) => {
  if (!transcript || timestamp === null || timestamp === undefined) return null
  const index = Math.floor(timestamp)
  if (index >= 0 && index < transcript.length) {
    const sentence = transcript[index]
    if (sentence && sentence.text) {
      return { sentence: sentence.text, index }
    }
  }
  return null
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

  // 解析翻译（双层释义）
  const definition = parseDefinition(currentWord.definition)
  const englishDefinition = getEnglishDefinition(currentWord.definition)
  const targetTranslation = definition.zh || definition.en || ''

  // 双例句
  const standardExample = currentWord.dictionary_cache?.example || currentWord.context_sentence
  const originalSentence = currentWord.material_info && currentWord.audio_timestamp !== null
    ? getOriginalSentence(currentWord.material_info.transcript, currentWord.audio_timestamp)
    : null
  const practiceUrl = originalSentence && currentWord.material_info
    ? `/topics/${categoryToSlug(currentWord.material_info.category)}/${currentWord.material_info.slug}?t=${currentWord.audio_timestamp}`
    : null

  // 双发音（智能路由）
  const hasUsR2Audio = isR2AudioUrl(currentWord.audio_url_us || currentWord.dictionary_cache?.audio_url_us)
  const hasUkR2Audio = isR2AudioUrl(currentWord.audio_url_uk || currentWord.dictionary_cache?.audio_url_uk)

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

  // 智能音频播放
  const playAudio = async (variant: 'us' | 'uk') => {
    const r2Url = variant === 'us'
      ? (currentWord.dictionary_cache?.audio_url_us || currentWord.audio_url_us)
      : (currentWord.dictionary_cache?.audio_url_uk || currentWord.audio_url_uk)

    // 优先使用 R2 音频
    if (r2Url && isR2AudioUrl(r2Url)) {
      try {
        const audio = new Audio(r2Url)
        await audio.play()
        return
      } catch (err) {
        console.warn('[ReviewOverlay] R2 音频播放失败:', err)
      }
    }

    // 兜底：Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(currentWord.word)
      utterance.lang = variant === 'us' ? 'en-US' : 'en-GB'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center text-white mb-4">
          <span className="text-lg font-semibold">
            {currentIndex + 1} / {words.length}
          </span>
        </div>

        <div className="relative">
          {/* 正面：拼写练习 */}
          <div
            className={`w-full bg-white rounded-2xl p-8 flex flex-col justify-between transition-all duration-500 ${
              flipped ? 'hidden' : 'block'
            } ${isCorrect ? 'shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 'shadow-2xl'}`}
          >
              <div>
                {/* 双层释义 */}
                <div className="mb-6 space-y-2">
                  {englishDefinition && (
                    <p className="text-base text-slate-500 text-center leading-relaxed">
                      {englishDefinition}
                    </p>
                  )}
                  {targetTranslation && (
                    <p className="text-xl font-bold text-gray-900 text-center leading-relaxed">
                      {targetTranslation}
                    </p>
                  )}
                </div>

                {/* 填空句 */}
                {(standardExample || originalSentence) && (
                  <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100/50">
                    <p
                      className="text-base text-gray-700 leading-relaxed text-center"
                      dangerouslySetInnerHTML={{
                        __html: createBlankSentence(standardExample || '', currentWord.word)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 双发音按钮 */}
              <div className="flex items-center justify-center gap-3 mb-6">
                {currentWord.phonetic && (
                  <p className="text-base text-gray-600 font-medium">
                    {currentWord.phonetic}
                  </p>
                )}

                {currentWord.phonetic && (hasUsR2Audio || hasUkR2Audio) && (
                  <div className="w-px h-5 bg-gray-200"></div>
                )}

                <button
                  onClick={() => playAudio('us')}
                  className={`flex items-center gap-1.5 transition-colors text-sm font-medium ${
                    hasUsR2Audio
                      ? 'text-blue-600 hover:text-blue-700'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                  title={hasUsR2Audio ? "美式发音 (R2)" : "美式发音 (生成)"}
                  disabled={!hasUsR2Audio && !hasUkR2Audio}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>US</span>
                </button>

                {(hasUsR2Audio || hasUkR2Audio) && (
                  <div className="w-px h-5 bg-gray-200"></div>
                )}

                <button
                  onClick={() => playAudio('uk')}
                  className={`flex items-center gap-1.5 transition-colors text-sm font-medium ${
                    hasUkR2Audio
                      ? 'text-purple-600 hover:text-purple-700'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                  title={hasUkR2Audio ? "英式发音 (R2)" : "英式发音 (生成)"}
                  disabled={!hasUsR2Audio && !hasUsR2Audio}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>UK</span>
                </button>
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

            {/* 背面：答案 + 自评 */}
            <div
              className={`w-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-8 flex flex-col text-white transition-all duration-500 ${
                flipped ? 'block' : 'hidden'
              }`}
            >
              <div className="flex-1 flex flex-col items-center justify-center mb-6">
                <h2 className="text-5xl font-bold mb-4">{currentWord.word}</h2>
                {currentWord.phonetic && (
                  <p className="text-xl text-blue-100">{currentWord.phonetic}</p>
                )}
              </div>

              {/* 双例句完整显示 */}
              <div className="space-y-4 mb-8">
                {/* 词典例句 */}
                {standardExample && (
                  <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-xs text-white/60 mb-2 font-medium">Dictionary Example</p>
                    <p className="text-sm text-white/90 leading-relaxed">
                      "{standardExample}"
                    </p>
                  </div>
                )}

                {/* 素材原句 */}
                {originalSentence && practiceUrl && (
                  <a
                    href={practiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white/20 rounded-lg p-4 backdrop-blur-sm hover:bg-white/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-white/60 font-medium">Material Context</p>
                      <div className="flex items-center gap-1 text-white/60 group-hover:text-white">
                        <ExternalLink className="w-3 h-3" />
                        <span className="text-xs">Practice</span>
                      </div>
                    </div>
                    <p
                      className="text-sm text-white/90 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: createHighlightSentence(originalSentence.sentence, currentWord.word)
                      }}
                    />
                    {currentWord.material_title && (
                      <p className="text-xs text-white/50 mt-2 truncate">
                        {currentWord.material_title}
                      </p>
                    )}
                  </a>
                )}
              </div>

              {/* 双发音按钮（背面） */}
              <div className="flex items-center justify-center gap-6 mb-8">
                <button
                  onClick={() => playAudio('us')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                    hasUsR2Audio
                      ? 'bg-white/20 hover:bg-white/30'
                      : 'bg-white/10 text-white/50'
                  }`}
                  disabled={!hasUsR2Audio && !hasUkR2Audio}
                >
                  <Volume2 className="w-5 h-5" />
                  <span className="font-semibold">US</span>
                </button>
                <button
                  onClick={() => playAudio('uk')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                    hasUkR2Audio
                      ? 'bg-white/20 hover:bg-white/30'
                      : 'bg-white/10 text-white/50'
                  }`}
                  disabled={!hasUsR2Audio && !hasUkR2Audio}
                >
                  <Volume2 className="w-5 h-5" />
                  <span className="font-semibold">UK</span>
                </button>
              </div>

              {/* 自评按钮 */}
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
  )
}
