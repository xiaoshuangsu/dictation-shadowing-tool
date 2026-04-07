/**
 * Vocabulary Category Content - 分类列表内容组件
 *
 * V2.5 - 真正的"语境笔记"卡片
 * - 双层释义结构：英文释义 + 目标语翻译
 * - 双例句展示：词典标准例句 + 素材实战原句
 * - 例句最多显示 2 行（line-clamp-2），超出省略
 * - 视觉区分：词典例句用灰底，素材例句用蓝色左边框
 * - 一键跳转回原素材练习页面
 * - 智能音频路由（R2 优先 + Web Speech API 兜底）
 * - 固定高度卡片，响应式布局
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Volume2, Search, ExternalLink } from 'lucide-react'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import { categoryToSlug } from '@/lib/utils/category'

// 单词数据接口
interface WordEntry {
  word: string
  phonetic: string
  definition: string
  example?: string
  audio_url?: string
  audio_url_us?: string
  audio_url_uk?: string
  translations?: Record<string, string>
  // My Words 专属字段
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

// 分类配置
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

// 翻译解析
function parseDefinition(definitionStr: string): Record<string, string> {
  try {
    const parsed = JSON.parse(definitionStr)

    // 新格式：直接是 translations 对象
    if (parsed.zh || parsed.en || parsed.vi) {
      return parsed
    }

    // 向后兼容：旧格式（zh-CN, zh-Hant）
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

// 获取当前语言的释义
function getCurrentTranslation(definition: string, currentLanguage: string): string {
  const parsed = parseDefinition(definition)

  // 语言映射
  const langMap: Record<string, string> = {
    'zh': 'zh',
    'zh_hant': 'zh_hant',
    'vi': 'vi',
    'hide': 'zh'
  }

  const key = langMap[currentLanguage] || 'zh'
  return parsed[key] || parsed['zh'] || parsed['en'] || definition
}

// 获取英文释义（用于双层显示）
function getEnglishDefinition(definition: string): string {
  const parsed = parseDefinition(definition)
  return parsed['en'] || ''
}

// 获取原句（通过 timestamp 查找）
function getOriginalSentence(
  transcript: any[] | null,
  timestamp: number | null
): { sentence: string; index: number } | null {
  // 修复：timestamp 可能为 0（有效值），不能使用 !timestamp 判断
  if (!transcript || timestamp === null || timestamp === undefined) return null

  // 查找对应 timestamp 的句子
  const index = Math.floor(timestamp)

  if (index >= 0 && index < transcript.length) {
    const sentence = transcript[index]
    if (sentence && sentence.text) {
      return {
        sentence: sentence.text,
        index: index
      }
    }
  }

  return null
}

// 判断是否为 R2 音频文件
function isR2AudioUrl(url?: string | null): boolean {
  if (!url || url.trim() === '' || url === 'null') return false
  // 排除 Google TTS 链接
  if (url.includes('translate.google.com') || url.includes('translate_tts')) return false
  // 判断是否为真实音频文件
  return url.includes('.mp3') || url.includes('.wav') || url.includes('.m4a') ||
         url.includes('audio/') || url.includes('media.') || url.includes('r2.')
}

// 单词卡片组件（固定高度 220px）
interface WordCardProps {
  word: WordEntry
  currentLanguage: string
  category: string
  onPlayAudio: (word: WordEntry, accent: 'us' | 'uk') => void
}

function WordCard({ word, currentLanguage, category, onPlayAudio }: WordCardProps) {
  // 解析翻译（双层释义）
  const englishDefinition = getEnglishDefinition(word.definition)
  const targetTranslation = getCurrentTranslation(word.definition, currentLanguage)

  // 标准例句（来自 dictionary_cache）
  const standardExample = word.dictionary_cache?.example || word.example

  // 素材原句（仅 My Words）- 多重兜底逻辑
  const originalSentence = word.material_info && word.audio_timestamp !== null
    ? getOriginalSentence(word.material_info.transcript, word.audio_timestamp)
    : null

  // 判断是否有有效的素材信息（用于生成跳转链接）
  const hasValidMaterialInfo = word.material_id && word.material_info && word.audio_timestamp !== null

  // 如果没有 transcript 原句，尝试使用 context_sentence
  const fallbackSentence = !originalSentence && word.context_sentence
    ? word.context_sentence
    : null

  // 生成跳转链接（优先使用 transcript，否则使用 material_id）
  const practiceUrl = hasValidMaterialInfo && word.material_info
    ? `/topics/${categoryToSlug(word.material_info.category)}/${word.material_info.slug}?t=${word.audio_timestamp}`
    : null

  // 判断是否有 R2 音频
  const hasUsR2Audio = isR2AudioUrl(word.audio_url_us || word.dictionary_cache?.audio_url_us)
  const hasUkR2Audio = isR2AudioUrl(word.audio_url_uk || word.dictionary_cache?.audio_url_uk)

  return (
    <div className="p-4 border border-gray-200 bg-white hover:shadow-md transition-all hover:border-blue-300">
      {/* 顶部：单词 + 音标 + 双发音按钮 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 truncate">{word.word}</h3>
          {word.phonetic && (
            <p className="text-xs text-gray-500 truncate">{word.phonetic}</p>
          )}
        </div>

        {/* US/UK 双发音按钮（始终显示，智能路由） */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* US 发音按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayAudio(word, 'us')
            }}
            className={`p-1.5 rounded-lg transition-colors group relative ${
              hasUsR2Audio
                ? 'text-blue-600 hover:bg-blue-50'  // R2 音频：蓝色
                : 'text-gray-400 hover:bg-gray-100' // TTS 兜底：灰色
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

          {/* UK 发音按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayAudio(word, 'uk')
            }}
            className={`p-1.5 rounded-lg transition-colors group relative ${
              hasUkR2Audio
                ? 'text-purple-600 hover:bg-purple-50'  // R2 音频：紫色
                : 'text-gray-400 hover:bg-gray-100' // TTS 兜底：灰色
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
        {/* 第一行：英文释义 */}
        {englishDefinition && (
          <p
            className="text-xs text-slate-500 truncate"
            title={englishDefinition}
          >
            {englishDefinition}
          </p>
        )}

        {/* 第二行：目标语翻译 */}
        {targetTranslation && targetTranslation !== englishDefinition ? (
          <p
            className="text-sm text-slate-700 truncate"
            title={targetTranslation}
          >
            {targetTranslation}
          </p>
        ) : null}

        {/* 容错：都无释义时显示占位符 */}
        {!englishDefinition && !targetTranslation && (
          <p className="text-sm text-slate-400 italic">
            Definition in flashcard
          </p>
        )}
      </div>

      {/* 例句区 A：词典标准例句（Dictionary Example） */}
      {standardExample && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2">
          <p
            className="text-xs text-slate-600 italic line-clamp-2 leading-relaxed"
            title={standardExample}
          >
            "{standardExample}"
          </p>
        </div>
      )}

      {/* 例句区 B：素材实战原句（Material Context） */}
      {(originalSentence || fallbackSentence) && practiceUrl ? (
        // 完整版：有素材信息和跳转链接（整体可点击）
        <Link
          href={practiceUrl}
          className="block border-l-2 border-blue-500 bg-blue-50/50 rounded-r-lg px-3 py-2.5 mb-2 hover:bg-blue-100 transition-all cursor-pointer group"
        >
          <p
            className="text-sm text-blue-700 italic line-clamp-2 leading-relaxed group-hover:underline"
            title={originalSentence ? originalSentence.sentence : (fallbackSentence || '')}
          >
            "{originalSentence ? originalSentence.sentence : (fallbackSentence || '')}"
          </p>
          {/* 极简来源标题 */}
          {word.material_title && (
            <p className="mt-1.5 text-[10px] text-slate-400 truncate" title={word.material_title}>
              {word.material_title}
            </p>
          )}
        </Link>
      ) : (originalSentence || fallbackSentence) ? (
        // 兜底版：没有跳转链接（静态显示）
        <div className="border-l-2 border-blue-400 bg-blue-50/30 rounded-r-lg px-3 py-2.5 mb-2">
          <p
            className="text-sm text-blue-600 italic line-clamp-2 leading-relaxed"
            title={originalSentence ? originalSentence.sentence : (fallbackSentence || '')}
          >
            "{originalSentence ? originalSentence.sentence : (fallbackSentence || '')}"
          </p>
          {/* 也显示来源标题（如果有的话） */}
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

// 主组件
export function VocabularyCategoryContent({ category }: { category: string }) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentLanguage, setCurrentLanguage] = useState('zh')

  const config = CATEGORY_CONFIG[category]

  // 播放音频（智能路由：R2 优先，Web Speech API 兜底）
  const handlePlayAudio = async (
    wordEntry: WordEntry,
    accent: 'us' | 'uk'
  ): Promise<void> => {
    const word = wordEntry.word

    // 优先使用 R2 音频
    const r2Url = accent === 'us'
      ? (wordEntry.dictionary_cache?.audio_url_us || wordEntry.audio_url_us)
      : (wordEntry.dictionary_cache?.audio_url_uk || wordEntry.audio_url_uk)

    // 如果有 R2 音频文件，直接播放
    if (r2Url && isR2AudioUrl(r2Url)) {
      try {
        const audio = new Audio(r2Url)
        await audio.play()
        console.log(`[音频] R2 音频播放成功 (${word} ${accent.toUpperCase()})`)
        return // 成功播放，直接返回
      } catch (err) {
        console.warn(`[音频] R2 音频播放失败 (${word} ${accent.toUpperCase()}):`, err)
        // 继续尝试 TTS
      }
    }

    // 兜底方案：使用 Web Speech API (浏览器原生 TTS)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        // 取消当前正在播放的语音
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(word)
        // 设置口音：美式英语或英式英语
        utterance.lang = accent === 'us' ? 'en-US' : 'en-GB'
        utterance.rate = 0.9 // 稍微放慢语速
        utterance.pitch = 1.0

        window.speechSynthesis.speak(utterance)
        console.log(`[TTS] Web Speech API 播放成功 (${word} ${accent.toUpperCase()})`)
        return
      } catch (err) {
        console.error(`[TTS] Web Speech API 播放失败 (${word} ${accent.toUpperCase()}):`, err)
        throw err
      }
    } else {
      console.warn(`[TTS] 浏览器不支持 Web Speech API`)
      throw new Error('浏览器不支持语音合成')
    }
  }

  // 监听语言变化
  useEffect(() => {
    const updateLanguage = () => {
      const lang = getStoredLanguage()
      setCurrentLanguage(lang === 'hide' ? 'zh' : lang)
    }

    updateLanguage()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'translation-language-preference') {
        updateLanguage()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('translation-language-change', updateLanguage)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('translation-language-change', updateLanguage)
    }
  }, [])

  // 加载数据
  useEffect(() => {
    if (!config) {
      router.push('/vocabulary')
      return
    }

    const loadWords = async () => {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 100))

      try {
        if (category === 'my-words' && user) {
          const response = await fetch('/api/user-words', {
            headers: { 'Authorization': `Bearer ${user.id}` }
          })

          if (response.ok) {
            const data = await response.json()
            const userWords: WordEntry[] = (data.words || []).map((w: any) => ({
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
            setWords(userWords)
          } else {
            setWords([])
          }
        } else {
          // 其他分类使用 Mock 数据（暂时）
          const mockCount = category === 'ielts' ? 50 : category === 'oxford-3000' ? 30 : 0

          // 生成 Mock 数据
          const mockWords: WordEntry[] = Array.from({ length: mockCount }, (_, i) => {
            const mockWord = `mockword${i + 1}`
            return {
              word: mockWord,
              phonetic: `/${mockWord}/`,
              definition: JSON.stringify({
                zh: `${mockWord}的中文释义`,
                en: `${mockWord} English definition`,
                vi: `${mockWord} Vietnamese`
              }),
              example: `This is an example sentence for ${mockWord}.`,
              audio_url: '',
              audio_url_us: '',
              audio_url_uk: ''
            }
          })

          setWords(mockWords)
        }
      } catch (error) {
        console.error('Failed to load words:', error)
        setWords([])
      } finally {
        setLoading(false)
      }
    }

    loadWords()
  }, [category, user, config, router])

  // 过滤后的单词
  const filteredWords = searchQuery
    ? words.filter(w => w.word.toLowerCase().includes(searchQuery.toLowerCase()))
    : words

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
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
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
              <p className="text-gray-600 mt-1">{config?.description} · {filteredWords.length} words</p>
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

      {/* 单词列表 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredWords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWords.map((word, index) => (
              <WordCard
                key={`${word.word}-${index}`}
                word={word}
                currentLanguage={currentLanguage}
                category={category}
                onPlayAudio={handlePlayAudio}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">
              {searchQuery ? 'No words found matching your search.' : 'No words in this collection yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
