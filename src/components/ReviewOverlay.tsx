/**
 * ReviewOverlay - 闪卡拼写训练遮罩层组件
 *
 * V2.1 - 添加统计联动
 * - 双层释义：英文释义 + 目标语翻译
 * - 双例句：词典标准例句 + 素材实战原句
 * - 智能音频路由：R2 优先 + Web Speech API 兜底
 * - 素材跳转：使用修复后的英文 Slug 路径
 * - 统计联动：复习完成后自动刷新首页统计
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
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import useSWR, { mutate } from 'swr'

interface ReviewWord {
  id: string
  word: string
  phonetic: string
  definition: string
  context_sentence?: string
  audio_url_us?: string
  audio_url_uk?: string
  translations?: string
  // 新增字段
  dictionary_cache?: {
    example?: string
    audio_url_us?: string | null
    audio_url_uk?: string | null
    translations?: string
  }
  material_info?: {
    category: string
    slug: string
    transcript?: any[] | null
  }
  audio_timestamp?: number | null
  material_title?: string
  next_review_at?: string | null  // 🔥 V3.3: 下次复习时间，用于判断复习模式
}

interface ReviewOverlayProps {
  words: ReviewWord[]
  user: AuthUser | null
  onClose: () => void
  startIndex?: number  // 🔥 V4.2: 起始索引（在原始列表中的位置）
  originalLength?: number  // 🔥 V4.2: 原始列表长度（用于进度显示）
  onReviewComplete?: (update: { dueWordsChange: number, reviewedChange: number }) => void  // 🔥 V4.5: 传递精确的计数更新
  initialDueWordsCount?: number  // 🔥 V3.3: 初始 Today's Review 数量（用于区分复习模式和主动练习）
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
        zh_hant: parsed['zh-Hant'] || '',
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

/**
 * 获取当前语言的释义（与 VocabularyCategoryContent 保持一致）
 *
 * 🌍 支持的语言映射（与数据库 translations 字段的键名对应）
 * 优先使用 translations 字段（19 国语言），回退到 definitions 字段（4 种语言）
 * 回退逻辑：目标语言 → 英文 → 简体中文 → 原始定义
 */
const getCurrentTranslation = (
  definitionStr: string,
  currentLanguage: string,
  translationsStr?: string | Record<string, any> | null
): string => {
  // 🔥 V3.2: 优先使用 matched_translation（简单字符串）
  if (translationsStr != null) {
    // 🔴 类型安全：确保 translationsStr 是字符串
    const translationsStrStr = String(translationsStr)

    // 检查是否是简单的翻译字符串（非 JSON 对象）
    if (!translationsStrStr.startsWith('{') && translationsStrStr.trim().length > 0) {
      return translationsStrStr
    }

    // 🔧 优先使用 translations 字段（19 国语言）
    try {
      const parsedTranslations = JSON.parse(translationsStrStr);
      if (Object.keys(parsedTranslations).length > 4) {
        // 这是完整的 19 国语言翻译
        const langMap: Record<string, string> = {
          'zh': 'zh',
          'zh_hant': 'zh_hant',
          'vi': 'vi',
          'ja': 'ja',
          'de': 'de',
          'es': 'es',
          'fr': 'fr',
          'ko': 'ko',
          'pt': 'pt',
          'ru': 'ru',
          'ar': 'ar',
          'th': 'th',
          'id': 'id',
          'ms': 'ms',
          'tr': 'tr',
          'el': 'el',
          'uk': 'uk',
          'bn': 'bn',
          'mn': 'mn',
          'hi': 'hi',
          'hide': 'zh'
        };

        const key = langMap[currentLanguage] || 'zh';
        const translation = parsedTranslations[key] || parsedTranslations['en'] || parsedTranslations['zh'];
        if (translation) {
          return translation;
        }
      }
    } catch (e) {
      // 静默处理解析错误，回退到 definitions 字段
    }
  }

  // 回退到 definitions 字段（4 种语言）
  const parsed = parseDefinition(definitionStr)

  // 🔧 语言映射 - 支持 19 种语言
  const langMap: Record<string, string> = {
    'zh': 'zh',
    'zh_hant': 'zh_hant',
    'vi': 'vi',
    'ja': 'ja',
    'de': 'de',
    'es': 'es',
    'fr': 'fr',
    'ko': 'ko',
    'pt': 'pt',
    'ru': 'ru',
    'ar': 'ar',
    'th': 'th',
    'id': 'id',
    'ms': 'ms',
    'tr': 'tr',
    'el': 'el',
    'uk': 'uk',
    'bn': 'bn',
    'mn': 'mn',
    'hi': 'hi',
    'hide': 'zh'
  }

  const key = langMap[currentLanguage] || 'zh'

  // 按优先级查找：目标语言 → 英文 → 简体中文 → 原始定义
  return parsed[key] || parsed['en'] || parsed['zh'] || definitionStr
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

export default function ReviewOverlay({ words, user, onClose, startIndex = 0, originalLength, onReviewComplete, initialDueWordsCount = 0 }: ReviewOverlayProps) {
  // 🔥 V4.3: 强制初始化为 0（因为传入的 words 已经是切片后的数组，words[0] 就是用户点击的那个词）
  const [currentIndex, setCurrentIndex] = useState(0)

  // 🔥 V4.2: 计算原始列表长度（用于进度显示）
  const totalWords = originalLength ?? words.length
  const [flipped, setFlipped] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [isCorrect, setIsCorrect] = useState(false | null)
  const [showedAnswer, setShowedAnswer] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState<string>('zh')
  const [isCompleted, setIsCompleted] = useState(false)
  const [cardDirection, setCardDirection] = useState<'left' | 'right'>('right')

  // 🔥 V4.1: 动态队列管理
  const [dynamicQueue, setDynamicQueue] = useState<ReviewWord[]>([])
  const [masteredWordIds, setMasteredWordIds] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)
  const isInitializedRef = useRef(false)  // 🔥 V4.2: 跟踪是否已初始化

  // 🔥 V4.3: 初始化队列 - 组件挂载时执行
  useEffect(() => {
    if (words.length > 0) {
      setDynamicQueue(words)
      setCurrentIndex(0)  // 🔥 V4.3: 强制初始化为 0
      setMasteredWordIds(new Set())
      setIsCompleted(false)
      setFlipped(false)
      setUserInput('')
      setIsCorrect(null)
      setShowedAnswer(false)
      isInitializedRef.current = true
    }
  }, [])  // 🔥 只在挂载时执行一次，不监听任何依赖

  // 🔥 V3.2: 动态关联释义 - 批量补全缺失的单词数据
  useEffect(() => {
    const fetchMissingDefinitions = async () => {
      if (!dynamicQueue || dynamicQueue.length === 0) return

      // 找出缺少释义的单词
      const wordsWithoutDefinition = dynamicQueue.filter(w => !w.definition || w.definition === '{}')

      if (wordsWithoutDefinition.length === 0) {
        console.log('[ReviewOverlay] ✅ 所有单词都有释义，无需补全')
        return
      }

      console.log('[ReviewOverlay] 🔄 发现', wordsWithoutDefinition.length, '个单词缺少释义，开始批量补全...')
      console.log('[ReviewOverlay] 🌍 当前语言偏好:', currentLanguage)

      try {
        // 🔥 V3.2: 传递目标语言参数
        const response = await fetch('/api/dictionary-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            words: wordsWithoutDefinition.map(w => w.word),
            targetLanguage: currentLanguage
          })
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[ReviewOverlay] ✅ 批量获取释义成功:', data.hitCount, '个命中,', data.missCount, '个未命中')

          // 合并数据到队列
          const updatedQueue = dynamicQueue.map(word => {
            if (!word.definition || word.definition === '{}') {
              const cached = data.words[word.word.toLowerCase()]
              if (cached) {
                console.log('[ReviewOverlay] ✅ 补全单词:', word.word, '| 匹配翻译:', cached.matched_translation || '无')

                // 🔥 V3.2: 优先使用 matched_translation，回退到完整 definitions
                const translationToUse = cached.matched_translation || ''

                return {
                  ...word,
                  phonetic: cached.phonetic || word.phonetic || '',
                  definition: cached.definitions ? JSON.stringify(cached.definitions) : '{}',
                  // 🔥 V3.2: 优先使用匹配的翻译，而不是整个 definitions 对象
                  translations: translationToUse || null,
                  context_sentence: cached.example || word.context_sentence || '',
                  dictionary_cache: {
                    ...word.dictionary_cache,
                    audio_url_us: cached.audio_url_us || '',
                    audio_url_uk: cached.audio_url_uk || '',
                    example: cached.example || '',
                    // 🔥 V3.2: 保存匹配的翻译
                    translations: translationToUse || null,
                    matched_translation: cached.matched_translation || null
                  }
                }
              }
            }
            return word
          })

          setDynamicQueue(updatedQueue)
          console.log('[ReviewOverlay] ✅ 队列更新完成，已补全', Object.keys(data.words).length, '个单词')
        } else {
          console.error('[ReviewOverlay] ❌ 批量获取释义失败:', response.status)
        }
      } catch (error) {
        console.error('[ReviewOverlay] 💥 批量获取释义出错:', error)
      }
    }

    // 延迟执行，确保队列已初始化且语言偏好已加载
    const timeoutId = setTimeout(() => {
      fetchMissingDefinitions()
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [dynamicQueue, currentLanguage]) // 🔥 V3.2: 监听队列和语言变化

  // 🔄 同步用户选择的语言偏好
  useEffect(() => {
    const updateLanguage = () => {
      const storedLang = getStoredLanguage()
      setCurrentLanguage(storedLang)
    }

    updateLanguage()

    window.addEventListener('translation-language-change', updateLanguage)

    return () => {
      window.removeEventListener('translation-language-change', updateLanguage)
    }
  }, [])

  // 自动聚焦输入框
  useEffect(() => {
    if (!flipped && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, flipped])

  // 重置显示答案状态
  useEffect(() => {
    setShowedAnswer(false)
  }, [currentIndex])

  const currentWord = dynamicQueue[currentIndex]
  const isLastCard = currentIndex === dynamicQueue.length - 1

  // 🔥 V4.1: 检查是否所有单词都已掌握
  const allWordsMastered = masteredWordIds.size === words.length

  // 🔥 V4.1: 空值检查 - 防止队列重置时 currentWord 为 undefined
  // 🔥 V3.1: 只检查 currentWord 是否存在，允许 definition 为 null
  if (!currentWord) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
          <p className="text-sm mt-2 text-gray-300">
            队列长度: {dynamicQueue.length} | 当前索引: {currentIndex}
          </p>
        </div>
      </div>
    )
  }

  // 解析翻译（双层释义）
  // 🔥 V3.1: 如果 definition 为 null，提供默认空对象
  const definition = parseDefinition(currentWord.definition || '{}')
  const englishDefinition = getEnglishDefinition(currentWord.definition)
  const targetTranslation = getCurrentTranslation(
    currentWord.definition,
    currentLanguage,
    currentWord.translations || currentWord.dictionary_cache?.translations
  )

  // 双例句
  const standardExample = currentWord.dictionary_cache?.example || currentWord.context_sentence

  // 🔧 修复：优先使用后端精确匹配的 matched_sentence（带内容校验）
  let originalSentence = null
  if (currentWord.material_info?.matched_sentence) {
    // 🔧 添加单词校验兜底：检查后端匹配的句子是否真的包含单词
    const targetWord = currentWord.word.toLowerCase()
    const matchedText = currentWord.material_info.matched_sentence.toLowerCase()

    if (matchedText.includes(targetWord)) {
      // 后端匹配正确，使用它
      originalSentence = {
        sentence: currentWord.material_info.matched_sentence,
        index: currentWord.material_info.matched_index
      }
    } else {
      // 后端匹配不正确，使用 context_sentence 作为兜底
      if (currentWord.context_sentence) {
        originalSentence = {
          sentence: currentWord.context_sentence,
          index: null
        }
      }
    }
  } else if (currentWord.material_info?.transcript && currentWord.audio_timestamp !== null) {
    // 兜底逻辑：使用前端匹配（仅当后端没有匹配结果时）
    originalSentence = getOriginalSentence(currentWord.material_info.transcript, currentWord.audio_timestamp)
  }
  const practiceUrl = originalSentence && currentWord.material_info
    ? `/topics/${categoryToSlug(currentWord.material_info.category)}/${currentWord.material_info.slug}?t=${currentWord.audio_timestamp}`
    : null

  // 双发音（智能路由）
  const hasUsR2Audio = isR2AudioUrl(currentWord.audio_url_us || currentWord.dictionary_cache?.audio_url_us)
  const hasUkR2Audio = isR2AudioUrl(currentWord.audio_url_uk || currentWord.dictionary_cache?.audio_url_uk)

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
        // R2 音频播放失败，使用兜底方案
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
    // 🔥 V4.5: 计算精确的计数更新
    let dueWordsChange = 0
    let reviewedChange = 0

    if (masteryStatus && user?.id) {
      // 判断是复习模式还是主动学习模式
      const wordNextReviewAt = currentWord.next_review_at
      const now = new Date()
      const isOriginallyDue = wordNextReviewAt && new Date(wordNextReviewAt) <= now

      if (isOriginallyDue) {
        // 🔥 复习模式（消耗任务）
        if (masteryStatus === 'learning') {
          // Still Learning：两者都不变
          dueWordsChange = 0
          reviewedChange = 0
        } else {
          // Kinda Know/Too Easy：Today's Review -1，Reviewed +1
          dueWordsChange = -1
          reviewedChange = 1
        }
      } else {
        // 🔥 主动学习（新增任务）
        if (masteryStatus === 'learning') {
          // Still Learning：Today's Review +1（将其加入今日待办）
          dueWordsChange = 1
          reviewedChange = 0
        } else {
          // Kinda Know/Too Easy：Reviewed +1
          dueWordsChange = 0
          reviewedChange = 1
        }
      }

      // 🔥 V4.5: 先触发乐观更新（立即更新UI）
      if (onReviewComplete) {
        onReviewComplete({ dueWordsChange, reviewedChange })
      }

      // 🔥 V4.5: 然后提交数据到 API
      try {
        const response = await fetch('/api/user-words', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`
          },
          body: JSON.stringify({
            wordId: currentWord.id,
            word: currentWord.word,
            definition: currentWord.definition,
            phonetic: currentWord.phonetic,
            translations: currentWord.translations,
            contextSentence: currentWord.context_sentence,
            audioUrl: currentWord.audio_url_us || currentWord.audio_url_uk,
            masteryStatus: masteryStatus
          })
        })

        if (response.ok) {
          await response.json()

          // 🔥 V4.4: 精准触发首页统计刷新（使用 SWR 数组格式 key）
          mutate(
            (key) => {
              // 匹配数组格式的 key: ['/api/user-words/stats', userId]
              if (Array.isArray(key) && key.length === 2) {
                return key[0] === '/api/user-words/stats' && key[1] === user.id
              }
              return false
            },
            undefined,
            { revalidate: true }
          )
        }
      } catch (error) {
        // 静默处理错误
      }
    }

    // 🔥 V4.1: 根据选择处理队列逻辑
    if (masteryStatus === 'learning') {
      // 选择 Still Learning：将单词移到队列末尾
      const wordToMove = dynamicQueue[currentIndex]
      const newQueue = [...dynamicQueue.slice(0, currentIndex), ...dynamicQueue.slice(currentIndex + 1)]
      newQueue.push(wordToMove)

      setDynamicQueue(newQueue)

      // 切换到下一个单词（如果已经在末尾，则回到开头）
      const nextIndex = currentIndex >= newQueue.length - 1 ? 0 : currentIndex
      setCurrentIndex(nextIndex)

    } else if (masteryStatus === 'familiar' || masteryStatus === 'mastered') {
      // 选择 Kinda Know 或 Too Easy：标记为已掌握
      setMasteredWordIds(prev => new Set(prev).add(currentWord.id))

      // 检查是否所有原始单词都已掌握
      const newMasteredSet = new Set(masteredWordIds).add(currentWord.id)
      if (newMasteredSet.size === words.length) {
        setIsCompleted(true)
        return
      }

      // 从队列中移除该单词
      const newQueue = dynamicQueue.filter((_, idx) => idx !== currentIndex)
      setDynamicQueue(newQueue)

      // 重置到第一个单词
      setCurrentIndex(0)
    }

    // 重置卡片状态
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
        {/* V4.0: 完成状态显示 */}
        {isCompleted ? (
          <div className="bg-white rounded-2xl p-12 shadow-2xl text-center animate-fade-in">
            <h2 className="text-4xl font-bold mb-4">All done! 🎉</h2>
            <p className="text-gray-600 mb-8">
              {`You've mastered all ${masteredWordIds.size} word${masteredWordIds.size > 1 ? 's' : ''}!`}
            </p>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Continue
            </button>
          </div>
        ) : (
          <>
            <div className="text-center text-white mb-4">
              <span className="text-lg font-semibold">
                {startIndex + currentIndex + 1} / {totalWords}
              </span>
            </div>

        <div className={`relative animate-fade-in-scale`}>
          <div key={currentIndex} className={`flashcard-container ${flipped ? '' : ''}`}>
          {/* 正面：拼写练习 */}
          <div
            className={`w-full bg-white rounded-2xl p-8 flex flex-col justify-between transition-all duration-500 ${
              flipped ? 'hidden' : 'block'
            } ${isCorrect ? 'shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 'shadow-2xl'}`}
          >
              <div>
                {/* 双层释义 */}
                <div className="mb-6 space-y-2">
                  {englishDefinition ? (
                    <p className="text-base text-slate-500 text-center leading-relaxed">
                      {englishDefinition}
                    </p>
                  ) : null}
                  {targetTranslation ? (
                    <p className="text-xl font-bold text-gray-900 text-center leading-relaxed">
                      {targetTranslation}
                    </p>
                  ) : null}

                  {/* 🔥 V3.2: 渲染兜底 - 显示"暂无释义" */}
                  {!englishDefinition && !targetTranslation && (
                    <p className="text-lg text-gray-400 text-center leading-relaxed italic">
                      暂无释义
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
          </>
        )}
      </div>
    </div>
  )
}
