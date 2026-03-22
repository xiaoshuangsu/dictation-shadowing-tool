/**
 * Vocabulary Page - 生词本列表页
 *
 * 功能：
 * - 展示用户保存的所有生词
 * - 显示多语言释义（根据全局设置）
 * - 显示例句和来源素材
 * - 支持删除和更新掌握状态
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'
import ReviewOverlay from '@/components/ReviewOverlay'  // 🔴 新增

interface UserWord {
  id: string
  user_id: string
  word: string
  phonetic: string
  definition: string  // JSON string
  context_sentence: string
  material_id: string | null
  material_title: string | null
  audio_timestamp: number | null
  audio_url: string | null
  mastery_status: 'learning' | 'familiar' | 'mastered'
  created_at: string
  dictionary_cache?: {
    audio_url_us: string | null
    audio_url_uk: string | null
  }
}

interface Definition {
  'zh-CN': string
  'zh-Hant': string
  'vi': string
  'en': string
}

export default function VocabularyPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [words, setWords] = useState<UserWord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentLanguage, setCurrentLanguage] = useState<keyof Definition>('zh-CN')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [materialInfoMap, setMaterialInfoMap] = useState<Record<string, { category: string; slug: string }>>({})
  const [trainingMode, setTrainingMode] = useState(false)  // 🔴 新增：训练模式状态

  // 获取生词列表
  const fetchWords = async () => {
    if (!user) return

    setLoading(true)
    try {
      const response = await fetch(`/api/user-words?status=${filterStatus === 'all' ? '' : filterStatus}`, {
        headers: { 'Authorization': `Bearer ${user.id}` }
      })
      const data = await response.json()

      if (data.success) {
        setWords(data.words || [])
      }
    } catch (error) {
      console.error('获取生词失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🔴 播放单词发音
  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放音频失败:', error)
    })
  }

  // 删除生词
  const handleDeleteWord = async (wordId: string) => {
    if (!user) return

    if (!confirm('Are you sure you want to delete this word?')) return

    try {
      const response = await fetch('/api/user-words', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          wordId
        })
      })

      const data = await response.json()
      if (data.success) {
        // 重新获取列表
        fetchWords()
      }
    } catch (error) {
      console.error('删除生词失败:', error)
    }
  }

  // 同步全局翻译语言
  useEffect(() => {
    const updateLanguage = () => {
      const storedLang = getStoredLanguage()
      const langMap: Record<string, keyof Definition> = {
        'zh': 'zh-CN',
        'zh_hant': 'zh-Hant',
        'vi': 'vi',
        'hide': 'zh-CN'
      }
      setCurrentLanguage(langMap[storedLang] || 'zh-CN')
    }

    // 初始化语言
    updateLanguage()

    // 监听 storage 变化（实现跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'translation-language') {
        updateLanguage()
      }
    }

    // 监听自定义事件（实现同页面内同步）
    const handleLanguageChange = () => {
      updateLanguage()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('translation-language-change', handleLanguageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('translation-language-change', handleLanguageChange)
    }
  }, [])

  // 加载生词列表
  useEffect(() => {
    if (user) {
      fetchWords()
    }
  }, [user, filterStatus])

  // 加载素材信息（用于生成播放链接）
  useEffect(() => {
    const fetchMaterialInfo = async () => {
      if (!words.length) return

      // 收集所有唯一的 material_id
      const materialIds = Array.from(new Set(words.map(w => w.material_id).filter(Boolean))) as string[]

      if (materialIds.length === 0) return

      try {
        const { data } = await supabase
          .from('materials')
          .select('id, title, category, slug')
          .in('id', materialIds)

        if (data) {
          const infoMap: Record<string, { category: string; slug: string }> = {}
          data.forEach(material => {
            infoMap[material.id] = {
              category: categoryToSlug(material.category),  // 将中文分类转换为英文 slug
              slug: material.slug || titleToSlug(material.title)
            }
          })
          setMaterialInfoMap(infoMap)
        }
      } catch (error) {
        console.error('Error loading material info:', error)
      }
    }

    fetchMaterialInfo()
  }, [words])

  // 登录中/未登录
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">请先登录</h1>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            前往登录
          </Link>
        </div>
      </div>
    )
  }

  // 解析多语言释义
  const parseDefinition = (definitionStr: string): Definition => {
    try {
      return JSON.parse(definitionStr)
    } catch {
      return {
        'zh-CN': definitionStr || '暂无释义',
        'zh-Hant': '',
        'vi': '',
        'en': ''
      }
    }
  }

  // 获取当前语言的释义
  const getCurrentDefinition = (definitionStr: string): string => {
    const def = parseDefinition(definitionStr)
    return def[currentLanguage] || def['zh-CN'] || 'No definition'
  }

  // 掌握状态配置
  const STATUS_CONFIG = {
    learning: { label: 'Learning', color: 'bg-blue-100 text-blue-800' },
    familiar: { label: 'Familiar', color: 'bg-yellow-100 text-yellow-800' },
    mastered: { label: 'Mastered', color: 'bg-green-100 text-green-800' }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vocabulary</h1>
              <p className="text-gray-600 mt-1">
                {words.length} words total
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* 🔴 新增：开始训练按钮 */}
              {words.length > 0 && (
                <button
                  onClick={() => setTrainingMode(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  Start Training
                </button>
              )}
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700"
              >
                Back to Practice
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            <span className="text-sm text-gray-700">Filter:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({words.length})
            </button>
            <button
              onClick={() => setFilterStatus('learning')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterStatus === 'learning'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Learning
            </button>
            <button
              onClick={() => setFilterStatus('mastered')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterStatus === 'mastered'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mastered
            </button>
          </div>
        </div>
      </div>

      {/* Word List */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : words.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">No words saved yet</p>
            <p className="text-sm text-gray-400">
              Click on any word in practice mode, then click "Add to Vocabulary" to save it
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {words.map((userWord) => {
              const definition = parseDefinition(userWord.definition)
              const statusConfig = STATUS_CONFIG[userWord.mastery_status] || STATUS_CONFIG.learning

              return (
                <div
                  key={userWord.id}
                  className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  {/* 单词和音标 */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-bold text-gray-900">
                        {userWord.word}
                      </h3>
                      <button
                        onClick={() => handleDeleteWord(userWord.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    {userWord.phonetic && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500">{userWord.phonetic}</p>
                        {/* 🔴 新增：US/UK 发音按钮 */}
                        {userWord.dictionary_cache?.audio_url_us && (
                          <button
                            onClick={() => playAudio(userWord.dictionary_cache!.audio_url_us!)}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                            title="US pronunciation (美音)"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            </svg>
                          </button>
                        )}
                        {userWord.dictionary_cache?.audio_url_uk && (
                          <button
                            onClick={() => playAudio(userWord.dictionary_cache!.audio_url_uk!)}
                            className="text-purple-600 hover:text-purple-700 transition-colors"
                            title="UK pronunciation (英音)"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 掌握状态 */}
                  <div className="mb-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* 释义 */}
                  <div className="mb-3">
                    <p className="text-sm text-gray-700">
                      {getCurrentDefinition(userWord.definition)}
                    </p>
                  </div>

                  {/* 例句 */}
                  {userWord.context_sentence && (
                    <div className="bg-gray-50 rounded p-2 mb-3">
                      <div className="flex items-start gap-2">
                        <p className="text-xs text-gray-600 italic flex-1">
                          "{userWord.context_sentence}"
                        </p>
                        {/* 播放图标 */}
                        {userWord.audio_url && userWord.material_id && materialInfoMap[userWord.material_id] && (
                          <Link
                            href={`/topics/${materialInfoMap[userWord.material_id].category}/${materialInfoMap[userWord.material_id].slug}?t=${userWord.audio_timestamp}`}
                            className="flex-shrink-0 text-blue-600 hover:text-blue-700"
                            title="Jump to play"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 来源素材 */}
                  {userWord.material_title && (
                    <div className="text-xs text-gray-500">
                      From: {userWord.material_title}
                    </div>
                  )}

                  {/* 时间 */}
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(userWord.created_at).toLocaleDateString('en-US')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 🔴 新增：训练遮罩层 */}
      {trainingMode && (
        <ReviewOverlay
          words={words.map(w => ({
            word: w.word,
            phonetic: w.phonetic || '',
            definition: parseDefinition(w.definition)['en'] || '',
            context_sentence: w.context_sentence || '',
            audio_url_us: undefined,  // 暂不处理音频
            audio_url_uk: undefined
          }))}
          onClose={() => setTrainingMode(false)}
        />
      )}
    </div>
  )
}
