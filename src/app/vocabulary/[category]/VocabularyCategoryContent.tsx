/**
 * Vocabulary Category Content - 分类列表内容组件
 *
 * V3.0 - 无限滚动 + 多语言翻译优化
 * - 3×5 黄金网格布局（桌面端）
 * - 无限滚动加载（每页 15 个单词）
 * - 完整多语言翻译支持
 * - 点击卡片进入闪卡练习
 */

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Volume2, Search } from 'lucide-react'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import { categoryToSlug } from '@/lib/utils/category'
import ReviewOverlay from '@/components/ReviewOverlay'
import { WordCardErrorBoundary } from '@/components/WordCardErrorBoundary'

// ══════════════════════════════════════════════════════════════════════════════
// 数据获取配置
// ══════════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 30 // 每页 30 个单词（增加页面大小，减少滚动请求）

// fetcher 函数 - 用于 user-words API（需要认证）
const fetcherWithAuth = async (url: string, userId: string) => {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${userId}` }
  })
  if (!response.ok) throw new Error('Failed to fetch user words')
  return response.json()
}

// fetcher 函数 - 用于 vocabulary-words API（公开 API，无需认证）
const fetcherPublic = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch vocabulary words')
  return response.json()
}

// ══════════════════════════════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════════════════════════════

interface WordEntry {
  word: string
  phonetic: string
  definition: string
  example?: string
  audio_url?: string
  audio_url_us?: string
  audio_url_uk?: string
  translations?: Record<string, string>
  context_sentence?: string
  material_id?: string | null
  material_title?: string | null
  audio_timestamp?: number | null
  material_info?: {
    category: string
    slug: string
    transcript: any[] | null
  }
  dictionary_cache?: {
    example?: string
    definitions?: string
    audio_url_us?: string | null
    audio_url_uk?: string | null
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 分类配置
// ══════════════════════════════════════════════════════════════════════════════

const CATEGORY_CONFIG: Record<string, { title: string; description: string; placeholder: boolean }> = {
  'my-words': {
    title: 'My Words',
    description: 'Your personal vocabulary collection',
    placeholder: false
  },
  'oxford-3000': {
    title: 'Oxford 3000',
    description: 'Essential English words for English learners',
    placeholder: false
  },
  'ielts': {
    title: 'IELTS Vocabulary',
    description: 'Academic words for IELTS preparation',
    placeholder: false
  },
  'daily-conversation': {
    title: 'Daily Conversation',
    description: 'Common words for daily life',
    placeholder: true
  },
  'business-english': {
    title: 'Business English',
    description: 'Professional vocabulary for work',
    placeholder: true
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 解析多语言释义 JSON
 * 统一格式：将所有格式转换为标准格式 {zh, zh_hant, vi, en, ...}
 */
function parseDefinition(definitionStr: string): Record<string, string> {
  try {
    const parsed = JSON.parse(definitionStr)

    // V3.0 格式（zh-CN, zh-Hant）→ 转换为标准格式
    if (parsed['zh-CN'] || parsed['zh-Hant']) {
      return {
        zh: parsed['zh-CN'] || '',
        zh_hant: parsed['zh-Hant'] || '',
        en: parsed.en || '',
        vi: parsed.vi || '',
        // 保留原始字段
        'zh-CN': parsed['zh-CN'],
        'zh-Hant': parsed['zh-Hant']
      }
    }

    // 已经是标准格式（zh, zh_hant）
    if (parsed.zh || parsed.zh_hant || parsed.en) {
      return parsed
    }

    // 兜底：返回原始字符串
    return { zh: definitionStr }
  } catch {
    return { zh: definitionStr }
  }
}

/**
 * 获取当前语言的释义
 *
 * 🌍 支持的语言映射（与数据库 translations 字段的键名对应）
 * 优先使用 translations 字段（19 国语言），回退到 definitions 字段（4 种语言）
 * 回退逻辑：目标语言 → 英文 → 简体中文 → 原始定义
 */
function getCurrentTranslation(
  definition: string,
  currentLanguage: string,
  translations?: string
): string {
  // 🔧 优先使用 translations 字段（19 国语言）
  if (translations) {
    try {
      const parsedTranslations = JSON.parse(translations);
      const transKeys = Object.keys(parsedTranslations);

      if (transKeys.length > 0) {
        // 语言映射
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

        // 按优先级查找：目标语言 → 英文 → 简体中文
        if (parsedTranslations[key]) {
          return parsedTranslations[key];
        }
        if (parsedTranslations['en']) {
          return parsedTranslations['en'];
        }
        if (parsedTranslations['zh']) {
          return parsedTranslations['zh'];
        }
      }
    } catch (e) {
      console.warn('[getCurrentTranslation] 解析 translations 失败，回退到 definitions:', e);
    }
  }

  // 回退到 definitions 字段（4 种语言）
  const parsed = parseDefinition(definition);

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

  const key = langMap[currentLanguage] || 'zh';

  // 按优先级查找：目标语言 → 英文 → 简体中文 → 原始定义
  return parsed[key] || parsed['en'] || parsed['zh'] || definition
}

/**
 * 获取英文释义
 */
function getEnglishDefinition(definition: string): string {
  const parsed = parseDefinition(definition)
  return parsed['en'] || ''
}

/**
 * 判断是否为 R2 音频文件
 */
function isR2AudioUrl(url?: string | null): boolean {
  if (!url || url.trim() === '' || url === 'null') return false
  if (url.includes('translate.google.com') || url.includes('translate_tts')) return false
  return url.includes('.mp3') || url.includes('.wav') || url.includes('.m4a') ||
         url.includes('audio/') || url.includes('media.') || url.includes('r2.')
}

// ══════════════════════════════════════════════════════════════════════════════
// 单词卡片组件
// ══════════════════════════════════════════════════════════════════════════════

interface WordCardProps {
  word: WordEntry
  currentLanguage: string
  category: string
  onPlayAudio: (word: WordEntry, accent: 'us' | 'uk') => void
  onClick: (word: WordEntry) => void
}

function WordCard({ word, currentLanguage, category, onPlayAudio, onClick }: WordCardProps) {
  // 🔧 空值检查
  if (!word) {
    return null
  }

  // 🔧 解析翻译（优先使用 translations 字段）
  let englishDefinition = ''
  let targetTranslation = ''

  try {
    englishDefinition = getEnglishDefinition(word.definition || '')
    targetTranslation = getCurrentTranslation(
      word.definition || '',
      currentLanguage,
      word.translations || word.dictionary_cache?.translations
    )
  } catch (e) {
    console.warn(`[WordCard] ${word.word} 翻译解析失败:`, e)
    englishDefinition = 'Definition in flashcard'
    targetTranslation = ''
  }

  // 🔍 详细调试日志（仅前 3 个单词）
  if (['abandon', 'abandonment', 'abc'].includes(word.word)) {
    console.log(`[WordCard] 📝 ${word.word} - 语言: ${currentLanguage}`, {
      englishDefinition: englishDefinition.substring(0, 40),
      targetTranslation: targetTranslation?.substring(0, 40)
    })
  }

  // 标准例句
  const standardExample = word.dictionary_cache?.example || word.example

  // 素材原句逻辑
  let originalSentence = null
  if (word.material_info?.matched_sentence) {
    const targetWord = word.word.toLowerCase()
    const matchedText = word.material_info.matched_sentence.toLowerCase()
    if (matchedText.includes(targetWord)) {
      originalSentence = {
        sentence: word.material_info.matched_sentence,
        index: word.material_info.matched_index
      }
    } else if (word.context_sentence) {
      originalSentence = { sentence: word.context_sentence, index: null }
    }
  } else if (word.material_info?.transcript && word.audio_timestamp !== null) {
    const index = Math.floor(word.audio_timestamp)
    if (index >= 0 && index < word.material_info.transcript.length) {
      const sentence = word.material_info.transcript[index]
      if (sentence && sentence.text) {
        originalSentence = { sentence: sentence.text, index }
      }
    }
  }

  const hasValidMaterialInfo = word.material_id && word.material_info && word.audio_timestamp !== null
  const fallbackSentence = !originalSentence && word.context_sentence ? word.context_sentence : null
  const practiceUrl = hasValidMaterialInfo && word.material_info
    ? `/topics/${categoryToSlug(word.material_info.category)}/${word.material_info.slug}?t=${word.audio_timestamp}`
    : null

  // 判断音频类型
  const hasUsR2Audio = isR2AudioUrl(word.audio_url_us || word.dictionary_cache?.audio_url_us)
  const hasUkR2Audio = isR2AudioUrl(word.audio_url_uk || word.dictionary_cache?.audio_url_uk)

  return (
    <div
      className="p-4 border border-gray-200 bg-white hover:shadow-md transition-all hover:border-blue-300 cursor-pointer"
      onClick={() => onClick(word)}
    >
      {/* 顶部：单词 + 音标 + 双发音按钮 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 truncate">{word.word}</h3>
          {word.phonetic && (
            <p className="text-xs text-gray-500 truncate">{word.phonetic}</p>
          )}
        </div>

        {/* US/UK 双发音按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayAudio(word, 'us')
            }}
            className={`p-1.5 rounded-lg transition-colors group relative ${
              hasUsR2Audio ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={hasUsR2Audio ? "美式发音 (R2)" : "美式发音 (生成)"}
          >
            <Volume2 className="w-4 h-4" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: hasUsR2Audio ? '#2563eb' : '#6b7280' }}
            >
              US
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayAudio(word, 'uk')
            }}
            className={`p-1.5 rounded-lg transition-colors group relative ${
              hasUkR2Audio ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={hasUkR2Audio ? "英式发音 (R2)" : "英式发音 (生成)"}
          >
            <Volume2 className="w-4 h-4" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: hasUkR2Audio ? '#9333ea' : '#6b7280' }}
            >
              UK
            </span>
          </button>
        </div>
      </div>

      {/* 释义区：双层释义结构 */}
      <div className="mb-2.5 space-y-1">
        {/* 英文释义 */}
        {englishDefinition && (
          <p className="text-xs text-slate-500 truncate" title={englishDefinition}>
            {englishDefinition}
          </p>
        )}

        {/* 🔍 目标语翻译 */}
        {targetTranslation && targetTranslation !== englishDefinition && (
          <p className="text-sm text-slate-700 truncate" title={targetTranslation}>
            {targetTranslation}
          </p>
        )}

        {/* 容错：都无释义时显示占位符 */}
        {!englishDefinition && !targetTranslation && (
          <p className="text-sm text-slate-400 italic">Definition in flashcard</p>
        )}
      </div>

      {/* 词典例句 */}
      {standardExample && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-slate-600 italic line-clamp-2 leading-relaxed" title={standardExample}>
            "{standardExample}"
          </p>
        </div>
      )}

      {/* 素材原句（仅 My Words） */}
      {(originalSentence || fallbackSentence) && practiceUrl ? (
        <Link
          href={practiceUrl}
          className="block border-l-2 border-blue-500 bg-blue-50/50 rounded-r-lg px-3 py-2.5 mb-2 hover:bg-blue-100 transition-all cursor-pointer group"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-blue-700 italic line-clamp-2 leading-relaxed group-hover:underline"
            title={originalSentence ? originalSentence.sentence : (fallbackSentence || '')}
          >
            "{originalSentence ? originalSentence.sentence : (fallbackSentence || '')}"
          </p>
          {word.material_title && (
            <p className="mt-1.5 text-[10px] text-slate-400 truncate" title={word.material_title}>
              {word.material_title}
            </p>
          )}
        </Link>
      ) : (originalSentence || fallbackSentence) ? (
        <div className="border-l-2 border-blue-400 bg-blue-50/30 rounded-r-lg px-3 py-2.5 mb-2">
          <p className="text-sm text-blue-600 italic line-clamp-2 leading-relaxed"
            title={originalSentence ? originalSentence.sentence : (fallbackSentence || '')}
          >
            "{originalSentence ? originalSentence.sentence : (fallbackSentence || '')}"
          </p>
          {word.material_title && (
            <p className="mt-1.5 text-[10px] text-slate-400 truncate" title={word.material_title}>
              {word.material_title}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════════════════════════════

export function VocabularyCategoryContent({ category }: { category: string }) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // 状态管理
  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentLanguage, setCurrentLanguage] = useState('zh')

  // 无限滚动状态
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalWords, setTotalWords] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // 闪卡状态
  const [flashcardWord, setFlashcardWord] = useState<WordEntry | null>(null)
  const [showFlashcard, setShowFlashcard] = useState(false)

  // Intersection Observer 引用
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const config = CATEGORY_CONFIG[category]

  // ══════════════════════════════════════════════════════════════════════════════
  // 数据获取
  // ══════════════════════════════════════════════════════════════════════════════

  // My Words API
  const shouldFetchUserWords = category === 'my-words' && user
  const { data: userWordsData, error: userWordsError } = useSWR(
    shouldFetchUserWords ? ['/api/user-words', user.id] : null,
    ([url, userId]) => fetcherWithAuth(url, userId as string),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false
    }
  )

  // Oxford 3000 / IELTS API - 支持分页
  const shouldFetchVocabularyWords = (category === 'oxford-3000' || category === 'ielts')
  const vocabularyApiUrl = shouldFetchVocabularyWords
    ? `/api/vocabulary-words?category=${category}&limit=${PAGE_SIZE}&offset=${currentPage * PAGE_SIZE}`
    : null

  const { data: vocabularyWordsData, error: vocabularyWordsError } = useSWR(
    vocabularyApiUrl,
    fetcherPublic,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false
    }
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // 数据处理
  // ══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!config) {
      router.push('/vocabulary')
      return
    }

    if (category === 'my-words') {
      // My Words 数据处理
      if (userWordsData?.words) {
        const mappedWords: WordEntry[] = userWordsData.words.map((w: any) => ({
          word: w.word,
          phonetic: w.phonetic || '',
          definition: w.definition,
          example: w.context_sentence || '',
          audio_url: w.audio_url || '',
          audio_url_us: w.dictionary_cache?.audio_url_us || '',
          audio_url_uk: w.dictionary_cache?.audio_url_uk || '',
          context_sentence: w.context_sentence,
          material_id: w.material_id,
          material_title: w.material_title,
          audio_timestamp: w.audio_timestamp,
          material_info: w.material_info,
          dictionary_cache: w.dictionary_cache
        }))
        setWords(mappedWords)
        setTotalWords(userWordsData.total || 0)
        setHasMore(false)
        setLoading(false)
      } else if (userWordsError) {
        console.error('Failed to load user words:', userWordsError)
        setWords([])
        setLoading(false)
      }
    } else if (shouldFetchVocabularyWords) {
      // Oxford 3000 / IELTS 数据处理（支持无限滚动）
      if (vocabularyWordsData?.words) {
        console.log('📥 [DEBUG] 收到 API 数据', {
          wordsCount: vocabularyWordsData.words.length,
          total: vocabularyWordsData.total,
          currentPage,
          offsetReturned: vocabularyWordsData.offset,
          limitReturned: vocabularyWordsData.limit
        })

        const mappedWords: WordEntry[] = vocabularyWordsData.words.map((w: any) => ({
          word: w.word,
          phonetic: w.phonetic || '',
          definition: w.definition,
          translations: w.translations,
          example: w.example || '',
          audio_url: w.audio_url || '',
          audio_url_us: w.audio_url_us || w.dictionary_cache?.audio_url_us || '',
          audio_url_uk: w.audio_url_uk || w.dictionary_cache?.audio_url_uk || '',
          context_sentence: null,
          material_id: null,
          material_title: null,
          audio_timestamp: null,
          material_info: null,
          dictionary_cache: w.dictionary_cache
        }))

        // 追加新数据（无限滚动）
        if (currentPage === 0) {
          console.log('📄 [DEBUG] 设置第一页数据，单词数:', mappedWords.length)
          setWords(mappedWords)
        } else {
          console.log('📄 [DEBUG] 追加第', currentPage, '页数据，单词数:', mappedWords.length)
          setWords(prev => [...prev, ...mappedWords])
        }

        const newTotal = vocabularyWordsData.total || 0
        const loadedSoFar = (currentPage + 1) * PAGE_SIZE
        const newHasMore = loadedSoFar < newTotal

        console.log('📊 [DEBUG] 计算 hasMore', {
          currentPage,
          PAGE_SIZE,
          loadedSoFar,
          newTotal,
          newHasMore
        })

        setTotalWords(newTotal)
        setHasMore(newHasMore)
        setLoading(false)
      } else if (vocabularyWordsError) {
        console.error('Failed to load vocabulary words:', vocabularyWordsError)
        setWords([])
        setLoading(false)
      }
    } else {
      setWords([])
      setLoading(false)
    }

  }, [category, user, config, router, userWordsData, userWordsError, vocabularyWordsData, vocabularyWordsError, currentPage, shouldFetchVocabularyWords])

  // ══════════════════════════════════════════════════════════════════════════════
  // 无限滚动逻辑
  // ══════════════════════════════════════════════════════════════════════════════

  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1
    console.log('🔄 [DEBUG] 触发加载下一页', {
      nextPage,
      hasMore,
      loading,
      isLoadingMore,
      currentPage
    })

    if (!hasMore || loading || isLoadingMore) {
      console.log('⚠️  [DEBUG] 加载被阻止', { hasMore, loading, isLoadingMore })
      return
    }

    console.log('✅ [DEBUG] 开始加载第', nextPage, '页')
    setIsLoadingMore(true)
    setCurrentPage(nextPage)

    // 数据加载完成后重置状态
    setTimeout(() => {
      console.log('🔄 [DEBUG] 重置 isLoadingMore 状态')
      setIsLoadingMore(false)
    }, 1000)
  }, [hasMore, loading, isLoadingMore, currentPage])

  // ══════════════════════════════════════════════════════════════════════════════
  // 无限滚动 - 使用 useLayoutEffect 确保在 DOM 渲染后绑定 observer
  // ══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // 只对 Oxford 3000 / IELTS 启用无限滚动
    if (!shouldFetchVocabularyWords) return

    console.log('🔍 [DEBUG] useEffect 执行，检查 ref:', {
      hasRef: !!loadMoreRef.current,
      hasMore,
      loading,
      isLoadingMore,
      wordsCount: words.length
    })

    // 使用 requestAnimationFrame 确保 DOM 完全渲染
    const rafId = requestAnimationFrame(() => {
      if (!loadMoreRef.current) {
        console.log('❌ [DEBUG] RAF 后 ref 仍为 null')
        return
      }

      console.log('✅ [DEBUG] RAF 后 ref 存在，创建 IntersectionObserver')

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          console.log('👀 [DEBUG] IntersectionObserver 触发', {
            isIntersecting: entry.isIntersecting,
            hasMore,
            loading,
            isLoadingMore
          })

          if (entry.isIntersecting && hasMore && !loading && !isLoadingMore) {
            console.log('🚀 [DEBUG] 检测到触底，触发加载')
            loadMore()
          }
        },
        { rootMargin: '600px', threshold: 0.1 }
      )

      observer.observe(loadMoreRef.current)
      observerRef.current = observer
    })

    return () => {
      cancelAnimationFrame(rafId)
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [shouldFetchVocabularyWords, hasMore, loading, isLoadingMore, loadMore, words.length])

  // ══════════════════════════════════════════════════════════════════════════════
  // 语言监听
  // ══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const updateLanguage = () => {
      const lang = getStoredLanguage()
      const finalLang = lang === 'hide' ? 'zh' : lang
      console.log('[VocabularyCategory] 🔄 语言更新:', {
        stored: lang,
        final: finalLang,
        timestamp: new Date().toISOString()
      })
      setCurrentLanguage(finalLang)
    }

    // 初始化时立即更新
    updateLanguage()

    const handleStorageChange = (e: StorageEvent) => {
      console.log('[VocabularyCategory] 📦 storage 事件:', e.key, e.newValue)
      if (e.key === 'translation-language-preference') {
        updateLanguage()
      }
    }

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent
      console.log('[VocabularyCategory] 📡 收到语言变化事件:', customEvent.detail)
      updateLanguage()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('translation-language-change', handleLanguageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('translation-language-change', handleLanguageChange)
    }
  }, [])

  // ══════════════════════════════════════════════════════════════════════════════
  // 音频播放
  // ══════════════════════════════════════════════════════════════════════════════

  const handlePlayAudio = async (wordEntry: WordEntry, accent: 'us' | 'uk'): Promise<void> => {
    const word = wordEntry.word
    const r2Url = accent === 'us'
      ? (wordEntry.dictionary_cache?.audio_url_us || wordEntry.audio_url_us)
      : (wordEntry.dictionary_cache?.audio_url_uk || wordEntry.audio_url_uk)

    if (r2Url && isR2AudioUrl(r2Url)) {
      try {
        const audio = new Audio(r2Url)
        await audio.play()
        console.log(`[音频] R2 音频播放成功 (${word} ${accent.toUpperCase()})`)
        return
      } catch (err) {
        console.warn(`[音频] R2 音频播放失败 (${word} ${accent.toUpperCase()}):`, err)
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(word)
        utterance.lang = accent === 'us' ? 'en-US' : 'en-GB'
        utterance.rate = 0.9
        utterance.pitch = 1.0
        window.speechSynthesis.speak(utterance)
        console.log(`[TTS] Web Speech API 播放成功 (${word} ${accent.toUpperCase()})`)
      } catch (err) {
        console.error(`[TTS] Web Speech API 播放失败 (${word} ${accent.toUpperCase()}):`, err)
        throw err
      }
    } else {
      throw new Error('浏览器不支持语音合成')
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 闪卡处理
  // ══════════════════════════════════════════════════════════════════════════════

  const handleOpenFlashcard = (word: WordEntry) => {
    setFlashcardWord(word)
    setShowFlashcard(true)
  }

  const handleCloseFlashcard = () => {
    setShowFlashcard(false)
    setFlashcardWord(null)
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 搜索过滤
  // ══════════════════════════════════════════════════════════════════════════════

  const filteredWords = searchQuery
    ? words.filter(w => w.word.toLowerCase().includes(searchQuery.toLowerCase()))
    : words

  // ══════════════════════════════════════════════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════════════════════════════════════════════

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // 未登录（仅限 my-words）
  if (!user && category === 'my-words') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Link href="/vocabulary" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">My Words</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Please Sign In</h2>
            <p className="text-gray-600 mb-6">Sign in to view your personal vocabulary collection</p>
            <Link href="/login" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 占位页面
  if (config?.placeholder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Link href="/vocabulary" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{config.title}</h1>
            <p className="text-gray-600 mt-1">{config.description}</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon</h2>
            <p className="text-gray-600">This vocabulary library is under development. Stay tuned!</p>
          </div>
        </div>
      </div>
    )
  }

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Link href="/vocabulary" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{config?.title}</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href="/vocabulary" className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{config?.title}</h1>
              <p className="text-gray-600 mt-1">
                {config?.description} · {filteredWords.length}/{totalWords} words
              </p>
            </div>
          </div>

          {/* 搜索框 */}
          {words.length > 0 && (
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* 单词列表 - 3×5 黄金网格 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredWords.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWords.map((word, index) => (
                <WordCardErrorBoundary key={`${word.word}-${index}`}>
                  <WordCard
                    word={word}
                    currentLanguage={currentLanguage}
                    category={category}
                    onPlayAudio={handlePlayAudio}
                    onClick={handleOpenFlashcard}
                  />
                </WordCardErrorBoundary>
              ))}
            </div>

            {/* 无限滚动触发器 - 始终渲染 ref，通过 display 控制可见性 */}
            <div
              ref={loadMoreRef}
              style={{
                display: shouldFetchVocabularyWords && hasMore ? 'flex' : 'none',
                minHeight: '200px'
              }}
              className="py-12 items-center justify-center bg-blue-50 border-2 border-dashed border-blue-300"
            >
              {isLoadingMore || loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-blue-600"></div>
                  <p className="text-sm text-gray-500">加载更多单词...</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">📌 向下滚动加载更多 (锚点可见)</p>
              )}
            </div>

            {/* 加载完成提示 */}
            {!hasMore && shouldFetchVocabularyWords && (
              <div className="py-8 text-center text-gray-500">
                <p>✅ All {totalWords} words loaded</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">
              {searchQuery ? 'No words found matching your search.' : 'No words in this collection yet.'}
            </p>
          </div>
        )}
      </div>

      {/* 闪卡模态框 */}
      {showFlashcard && flashcardWord && user && (
        <ReviewOverlay
          words={[{
            id: flashcardWord.id || '',
            word: flashcardWord.word,
            phonetic: flashcardWord.phonetic || '',
            definition: flashcardWord.definition,
            translations: flashcardWord.translations,
            context_sentence: flashcardWord.context_sentence || flashcardWord.dictionary_cache?.example || '',
            audio_url_us: flashcardWord.audio_url_us || flashcardWord.dictionary_cache?.audio_url_us || '',
            audio_url_uk: flashcardWord.audio_url_uk || flashcardWord.dictionary_cache?.audio_url_uk || '',
            dictionary_cache: flashcardWord.dictionary_cache,
            material_info: flashcardWord.material_info,
            audio_timestamp: flashcardWord.audio_timestamp,
            material_title: flashcardWord.material_title
          }]}
          user={user}
          onClose={handleCloseFlashcard}
        />
      )}
    </div>
  )
}
