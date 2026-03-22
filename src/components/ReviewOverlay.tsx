/**
 * ReviewOverlay - 闪卡拼写训练遮罩层组件
 *
 * 功能：
 * - 全屏遮罩层，用于闪卡训练
 * - 显示单词释义和填空句
 * - 实时校验拼写
 * - 3D 翻转动画展示答案
 * - 支持切换到下一个单词
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Volume2, X } from 'lucide-react'

interface ReviewWord {
  word: string
  phonetic: string
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [isCorrect, setIsCorrect] = useState(false | null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentWord = words[currentIndex]
  const isLastCard = currentIndex === words.length - 1

  // 解析当前单词的释义
  const definition = parseDefinition(currentWord.definition)
  const displayDefinition = definition['en'] || definition['zh-CN'] || 'No definition'

  // 🔴 自动聚焦输入框
  useEffect(() => {
    if (!flipped && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, flipped])

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
    }
  }

  // 🔴 处理 Enter 键提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isCorrect && !flipped) {
      setFlipped(true)
    }
  }

  // 🔴 下一个单词
  const handleNext = () => {
    if (isLastCard) {
      onClose()  // 最后一个单词，关闭训练
      return
    }

    setCurrentIndex(prev => prev + 1)
    setFlipped(false)
    setUserInput('')
    setIsCorrect(null)
  }

  // 🔴 创建填空句（智能匹配，忽略大小写和标点）
  const createBlankSentence = (sentence: string, word: string) => {
    // 转义特殊字符
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 匹配单词（忽略大小写）
    const regex = new RegExp(`\\\\b${escapedWord}\\\\b`, 'gi')
    return sentence.replace(regex, '_____')
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
          className={`relative w-full h-[500px] perspective-1000 ${
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
              className="absolute w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* 释义 */}
              <div className="flex-1 flex items-center justify-center mb-8">
                <p className="text-4xl font-bold text-gray-900 text-center">
                  {displayDefinition}
                </p>
              </div>

              {/* 填空句 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-8 border-l-4 border-blue-500">
                <p className="text-lg text-gray-700 leading-relaxed">
                  {createBlankSentence(currentWord.context_sentence, currentWord.word)}
                </p>
              </div>

              {/* 输入框 */}
              <div className="space-y-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type the word..."
                  className={`w-full px-6 py-4 text-2xl text-center border-2 rounded-lg transition-colors ${
                    isCorrect === true
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : isCorrect === false
                      ? 'border-red-300 bg-red-50 text-red-900'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                  }`}
                  disabled={flipped}
                  autoComplete="off"
                />

                {/* 提示文字 */}
                {!flipped && userInput.length > 0 && (
                  <p className="text-center text-sm">
                    {isCorrect === true ? (
                      <span className="text-green-600 font-semibold">✓ Correct! Press Enter or wait...</span>
                    ) : isCorrect === false ? (
                      <span className="text-red-600">Keep trying...</span>
                    ) : null}
                  </p>
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
              {/* 单词和音标 */}
              <div className="flex-1 flex flex-col items-center justify-center mb-8">
                <h2 className="text-5xl font-bold mb-4">{currentWord.word}</h2>
                {currentWord.phonetic && (
                  <p className="text-xl text-blue-100">{currentWord.phonetic}</p>
                )}
              </div>

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

              {/* Next 按钮 */}
              <button
                onClick={handleNext}
                className="w-full px-8 py-4 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors text-lg"
              >
                {isLastCard ? 'Finish' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
