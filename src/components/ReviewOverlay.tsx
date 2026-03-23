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
 * 修复：
 * - 修复答案泄露问题（Cloze 打码）
 * - 在背面显示完整原句
 * - 正面添加音标和发音按钮
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Volume2, X } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

interface ReviewWord {
  id: string  // user_words 表的 ID（用于更新状态）
  word: string
  phonetic: string
  pos?: string  // 词性 (part of speech)
  definition: string  // JSON string 或纯文本
  context_sentence: string
  audio_url_us?: string
  audio_url_uk?: string
}

interface ReviewOverlayProps {
  words: ReviewWord[]
  onClose: () => void
}

// 解析多语言释义
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

export default function ReviewOverlay({ words, onClose }: ReviewOverlayProps) {
  const { user } = useAuth()  // 🔴 获取用户信息
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [isCorrect, setIsCorrect] = useState(false | null)
  const [showedAnswer, setShowedAnswer] = useState(false)  // 是否点击了"查看答案"
  const [isShaking, setIsShaking] = useState(false)  // 抖动效果
  const inputRef = useRef<HTMLInputElement>(null)

  const currentWord = words[currentIndex]
  const isLastCard = currentIndex === words.length - 1

  // 解析当前单词的释义
  const definition = parseDefinition(currentWord.definition)
  const chineseDefinition = definition['zh-CN'] || ''
  const englishDefinition = definition['en'] || ''

  // 🔴 自动聚焦输入框
  useEffect(() => {
    if (!flipped && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, flipped])

  // 🔴 切换卡片时重置状态
  useEffect(() => {
    setShowedAnswer(false)
  }, [currentIndex])

  // 🔴 实时校验拼写
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUserInput(value)

    const normalizedInput = value.toLowerCase().trim()
    const normalizedWord = currentWord.word.toLowerCase()

    if (normalizedInput === normalizedWord) {
      setIsCorrect(true)
      // 延迟翻转，让用户看到完整的正确单词
      setTimeout(() => {
        setFlipped(true)
      }, 300)
    } else {
      setIsCorrect(false)
      // 如果输入完整但错误，触发抖动效果
      if (value.length > 0 && value.length >= normalizedWord.length) {
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 500)
      }
    }
  }

  // 🔴 处理 Enter 键提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !flipped) {
      // 如果已答对，翻转
      if (isCorrect) {
        setFlipped(true)
      }
      // 如果输入框为空，触发"查看答案"
      else if (userInput.trim() === '') {
        handleShowAnswer()
      }
    }
  }

  // 🔴 查看答案
  const handleShowAnswer = () => {
    setShowedAnswer(true)
    setFlipped(true)
  }

  // 🔴 下一个单词
  const handleNext = async (masteryStatus?: 'learning' | 'mastered') => {
    // 更新数据库掌握状态
    if (masteryStatus && user?.id) {
      console.log(`[ReviewOverlay] 更新单词 "${currentWord.word}" (ID: ${currentWord.id}) 掌握状态为: ${masteryStatus}`)

      try {
        // 调用 API 更新掌握状态
        const response = await fetch('/api/user-words', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`  // 🔴 传递用户 ID
          },
          body: JSON.stringify({
            wordId: currentWord.id,
            masteryStatus: masteryStatus === 'mastered' ? 'mastered' : 'learning'
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log(`[ReviewOverlay] ✅ 成功更新单词状态:`, result)
        } else {
          const errorData = await response.json()
          console.error('[ReviewOverlay] ❌ 更新单词状态失败:', errorData)
        }
      } catch (error) {
        console.error('[ReviewOverlay] 更新单词状态出错:', error)
      }
    }

    // 如果是"Still Learning"，翻转回正面，继续练习当前单词
    if (masteryStatus === 'learning') {
      setFlipped(false)
      setUserInput('')
      setIsCorrect(null)
      setShowedAnswer(false)
      return
    }

    // 如果是"Mastered"或没有选择，切换到下一个单词
    if (isLastCard) {
      onClose()  // 最后一个单词，关闭训练
      return
    }

    setCurrentIndex(prev => prev + 1)
    setFlipped(false)
    setUserInput('')
    setIsCorrect(null)
    setShowedAnswer(false)
  }

  // 🔴 创建填空句（智能 Cloze 打码，修复答案泄露）
  const createBlankSentence = (sentence: string, word: string) => {
    const lowerWord = word.toLowerCase().trim()

    // 🔴 策略：使用更宽松的匹配规则
    // 1. 首先尝试精确匹配（忽略大小写）
    let processed = sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), (match) => {
      // 🔴 深色下划线提示用户这里需要填写
      return `<span class="font-bold text-blue-600 border-b-2 border-blue-600 bg-blue-50 px-1 rounded">${'_____'}</span>`
    })

    // 2. 如果没有替换，尝试匹配单词的任何变形（包含该单词的词）
    if (!processed.includes('<span')) {
      // 匹配包含该单词的任何形式（如 talked → talk，talks → talk）
      const pattern = new RegExp(`\\b\\w*${lowerWord}\\w*\\b`, 'gi')
      processed = sentence.replace(pattern, (match) => {
        return `<span class="font-bold text-blue-600 border-b-2 border-blue-600 bg-blue-50 px-1 rounded">${'_____'}</span>`
      })
    }

    return processed
  }

  // 🔴 创建高亮原句（背面显示，高亮目标词）
  const createHighlightSentence = (sentence: string, word: string) => {
    const lowerWord = word.toLowerCase().trim()

    // 首先尝试精确匹配
    let processed = sentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), (match) => {
      return `<span class="font-bold text-yellow-300 bg-yellow-500/30 px-1 rounded">${match}</span>`
    })

    // 如果没有替换，尝试匹配单词的任何变形
    if (!processed.includes('<span')) {
      const pattern = new RegExp(`\\b\\w*${lowerWord}\\w*\\b`, 'gi')
      processed = sentence.replace(pattern, (match) => {
        return `<span class="font-bold text-yellow-300 bg-yellow-500/30 px-1 rounded">${match}</span>`
      })
    }

    return processed
  }

  // 🔴 播放音频
  const playAudio = (variant: 'us' | 'uk') => {
    const audioUrl = variant === 'us' ? currentWord.audio_url_us : currentWord.audio_url_uk
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play().catch(err => console.error('播放失败:', err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
      >
        <X className="w-8 h-8" />
      </button>

      {/* 闪卡容器 */}
      <div className="w-full max-w-2xl">
        {/* 进度指示器 */}
        <div className="text-center text-white mb-4">
          <span className="text-lg font-semibold">
            {currentIndex + 1} / {words.length}
          </span>
        </div>

        {/* 3D 翻转容器 */}
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
            {/* 🔴 正面：Question Face */}
            <div
              className={`absolute w-full h-full bg-white rounded-2xl p-6 flex flex-col justify-between transition-shadow duration-300 ${
                isCorrect ? 'shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 'shadow-2xl'
              }`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* 顶部区域：词性 + 释义 */}
              <div>
                {/* 词性 - 置顶显示 */}
                {currentWord.pos && (
                  <div className="text-center mb-3">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">
                      {currentWord.pos}
                    </span>
                  </div>
                )}

                {/* 释义区域：中文翻译（主）+ 英文定义（辅） */}
                <div className="text-center">
                  {/* 中文翻译 - 主要提示 */}
                  {chineseDefinition && (
                    <p className="text-[22px] font-bold text-gray-900 text-center mb-2">
                      {chineseDefinition}
                    </p>
                  )}
                  {/* 英文定义 - 辅助参考 */}
                  {englishDefinition && (
                    <p className="text-base text-gray-400 text-center">
                      {englishDefinition}
                    </p>
                  )}
                </div>
              </div>

              {/* 中间区域：例句块（正中心） */}
              <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100/50 my-4">
                <p
                  className="text-base text-gray-700 leading-relaxed text-center"
                  dangerouslySetInnerHTML={{
                    __html: createBlankSentence(currentWord.context_sentence, currentWord.word)
                  }}
                />
              </div>

              {/* 例句块下方：音标 + 发音按钮 */}
              <div className="flex items-center justify-center gap-3 mb-4">
                {/* 音标 */}
                {currentWord.phonetic && (
                  <p className="text-base text-gray-600 font-medium">
                    {currentWord.phonetic}
                  </p>
                )}

                {/* 分隔线 - 音标与喇叭之间 */}
                {currentWord.phonetic && (currentWord.audio_url_us || currentWord.audio_url_uk) && (
                  <div className="w-px h-5 bg-gray-200"></div>
                )}

                {/* US 发音按钮 */}
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

                {/* 分隔线 - US与UK之间 */}
                {currentWord.audio_url_us && currentWord.audio_url_uk && (
                  <div className="w-px h-5 bg-gray-200"></div>
                )}

                {/* UK 发音按钮 */}
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

              {/* 底部区域：输入框 */}
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

                {/* 提示文字 */}
                {!flipped && userInput.length > 0 && (
                  <p className="text-center text-sm">
                    {isCorrect === true ? (
                      <span className="text-green-600 font-semibold">✓ Correct! Flipping...</span>
                    ) : isCorrect === false ? (
                      <span className="text-red-500">Keep trying...</span>
                    ) : null}
                  </p>
                )}

                {/* Show Answer 按钮 - 只保留英文 */}
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

            {/* 🔴 背面：Answer Face */}
            <div
              className="absolute w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-8 flex flex-col text-white"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              {/* 单词标题 */}
              <div className="flex-1 flex flex-col items-center justify-center mb-6">
                <h2 className="text-5xl font-bold mb-4">{currentWord.word}</h2>
                {currentWord.phonetic && (
                  <p className="text-xl text-blue-100">{currentWord.phonetic}</p>
                )}
              </div>

              {/* 🔴 完整原句（高亮目标词） */}
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

              {/* 音频按钮 */}
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

              {/* 自评按钮 */}
              {isCorrect || showedAnswer ? (
                <div className="space-y-3">
                  {/* 状态提示 */}
                  <p className="text-center text-sm text-white/80 mb-2">
                    {isCorrect ? 'Great job!' : 'Keep practicing!'}
                  </p>

                  {/* 两个选择按钮 */}
                  <div className="flex gap-3">
                    {/* Still Learning */}
                    <button
                      onClick={() => handleNext('learning')}
                      className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                        showedAnswer && !isCorrect
                          ? 'bg-orange-500 text-white shadow-lg'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      Still Learning
                    </button>

                    {/* Mastered */}
                    <button
                      onClick={() => handleNext('mastered')}
                      className="flex-1 px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all"
                    >
                      Mastered
                    </button>
                  </div>
                </div>
              ) : (
                /* 默认 Next 按钮（向后兼容） */
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
