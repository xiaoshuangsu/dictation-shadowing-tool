/**
 * Vocabulary Category Content - 分类列表内容组件
 *
 * 功能：
 * - 单词卡片展示
 * - 音频播放
 * - Mock 数据填充
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Volume2, Search } from 'lucide-react'

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

// Mock 数据生成器
function generateMockWords(count: number): WordEntry[] {
  const words: WordEntry[] = []
  const prefixes = ['anti', 'auto', 'bi', 'co', 'de', 'dis', 'en', 'ex', 'fore', 'hyper']
  const roots = ['act', 'form', 'port', 'scribe', 'tract', 'vert', 'vis', 'struct', 'ject', 'press']
  const suffixes = ['tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence', 'ship', 'hood', 'dom']

  for (let i = 0; i < count; i++) {
    const prefix = prefixes[i % prefixes.length]
    const root = roots[i % roots.length]
    const suffix = suffixes[i % suffixes.length]
    const word = prefix + root + suffix + (i + 1)

    words.push({
      word: word,
      phonetic: `/${word}/`,
      definition: `A word formed by combining ${prefix}, ${root}, and ${suffix}`,
      example: `The ${word} effect was clearly visible in the results.`,
      audio_url: '',
      translations: {
        'zh': `${word}的中文释义`,
        'vi': `${word}的越南语释义`,
        'es': `${word}的西班牙语释义`
      }
    })
  }

  return words
}

// 单词卡片组件
function WordCard({ word, onPlayAudio }: { word: WordEntry; onPlayAudio: (word: WordEntry) => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200 hover:shadow-md transition-all hover:border-blue-300">
      {/* 单词和音标 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1">{word.word}</h3>
          {word.phonetic && (
            <p className="text-sm text-gray-500">{word.phonetic}</p>
          )}
        </div>

        {/* 音频播放按钮 */}
        <button
          onClick={() => onPlayAudio(word)}
          className="flex-shrink-0 ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="播放发音"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {/* 释义 */}
      <div className="mb-3">
        <p className="text-sm text-gray-700">{word.definition}</p>
      </div>

      {/* 例句 */}
      {word.example && (
        <div className="bg-gray-50 rounded p-3 mb-3">
          <p className="text-xs text-gray-600 italic">"{word.example}"</p>
        </div>
      )}

      {/* 多语言翻译 */}
      {word.translations && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(word.translations).slice(0, 3).map(([lang, translation]) => (
            <span
              key={lang}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
            >
              {lang}: {translation}
            </span>
          ))}
        </div>
      )}
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

  const config = CATEGORY_CONFIG[category]

  // 加载数据
  useEffect(() => {
    // 检查分类是否有效
    if (!config) {
      router.push('/vocabulary')
      return
    }

    const loadWords = async () => {
      setLoading(true)

      // 延迟执行，避免阻塞首次渲染
      await new Promise(resolve => setTimeout(resolve, 100))

      try {
        // 如果是 my-words，从 API 加载
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
              audio_url_uk: w.dictionary_cache?.audio_url_uk || ''
            }))
            setWords(userWords)
          } else {
            setWords([])
          }
        } else {
          // 其他分类使用 Mock 数据
          const mockCount = category === 'ielts' ? 50 : category === 'oxford-3000' ? 30 : 0
          setWords(generateMockWords(mockCount))
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

  // 播放音频
  const handlePlayAudio = (word: WordEntry) => {
    const audioUrl = word.audio_url || word.audio_url_us || word.audio_url_uk
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play().catch(error => {
        console.error('播放音频失败:', error)
      })
    }
  }

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

  // 过滤后的单词
  const filteredWords = searchQuery
    ? words.filter(w => w.word.toLowerCase().includes(searchQuery.toLowerCase()))
    : words

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
