/**
 * Vocabulary Page - 生词本列表页
 *
 * V29.7.2 彻底重构（修复 React Error #310）：
 * - 所有 Hook 绝对顶层化
 * - 提前状态判断，避免 JSX 中的复杂条件
 * - SWR 容错化，支持 null key
 * - 确保 Hook 调用顺序完全固定
 */

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'
import ReviewOverlay from '@/components/ReviewOverlay'
import { useUserWords } from '@/lib/hooks/useUserWords'

interface UserWord {
  id: string
  user_id: string
  word: string
  phonetic: string
  definition: string
  context_sentence: string
  material_id: string | null
  material_title: string | null
  audio_timestamp: number | null
  audio_url: string | null
  mastery_status: 'learning' | 'familiar' | 'mastered'
  created_at: string
  next_review_at?: string | null
  review_level?: number
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

export function VocabularyPageContent() {
  // ============================================================
  // 🔴 第一阶段：Hook 堆放区（无条件执行，绝对顶部）
  // ============================================================

  // Auth Hooks
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // State Hooks
  const [currentLanguage, setCurrentLanguage] = useState<keyof Definition>('zh-CN')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [materialInfoMap, setMaterialInfoMap] = useState<Record<string, { category: string; slug: string }>>({})
  const [trainingMode, setTrainingMode] = useState(false)
  const [singleWordTraining, setSingleWordTraining] = useState<UserWord | null>(null)  // 🔴 单点练习模式

  // 🔴 SWR Hook（容错化：支持 null key）
  const { data, words, isLoading, isValidating, error, mutate } = useUserWords(filterStatus, user?.id)

  // 🔴 关键优化：只在首次加载且没有任何数据时显示 Loading
  // 判断逻辑：
  // - isLoading: 正在加载
  // - !data: 没有缓存数据（首次访问）
  // - !error: 没有错误
  // 这确保从 Topics 切回 Vocabulary 时，如果缓存存在，不会显示 Loading
  const shouldShowLoading = isLoading && !data && !error

  // Derived State Hooks
  const dueCount = useMemo(() => {
    if (!words || !words.length) return 0
    const now = new Date()
    return words.filter((word: UserWord) => {
      if (word.mastery_status !== 'learning') return false
      if (!word.next_review_at) return true
      return new Date(word.next_review_at) <= now
    }).length
  }, [words])

  // Effect Hooks
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

    updateLanguage()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'translation-language') {
        updateLanguage()
      }
    }

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

  useEffect(() => {
    const fetchMaterialInfo = async () => {
      if (!words || !words.length) return

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
              category: categoryToSlug(material.category),
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

  // ============================================================
  // 🔴 第二阶段：逻辑拦截区（在所有 Hook 之后）
  // ============================================================

  // 提前状态判断，避免 JSX 中的复杂条件
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Vocabulary</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">请先登录</h1>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              前往登录
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 🔴 关键修复：只在首次加载且无缓存时显示 Loading
  // 如果有缓存数据（data 存在），即使 isLoading 也不显示 Loading
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Vocabulary</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!words || words.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Vocabulary</h1>
            <p className="text-gray-600 mt-1">0 words total</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">No words saved yet</p>
            <p className="text-sm text-gray-400">
              Click on any word in practice mode, then click "Add to Vocabulary" to save it
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 🔴 第三阶段：辅助函数定义（在 return 之前）
  // ============================================================

  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放音频失败:', error)
    })
  }

  // 🔴 新增：处理单词卡片点击（单点练习模式）
  const handleWordCardClick = (word: UserWord, e: React.MouseEvent) => {
    // 防止删除按钮、发音按钮等触发
    e.stopPropagation()
    setSingleWordTraining(word)
  }

  // 🔴 新增：关闭单点练习模式
  const handleCloseSingleTraining = () => {
    setSingleWordTraining(null)
    mutate(undefined, true)  // 🔴 强制重新验证，确保从数据库获取最新状态
  }

  // 🔴 新增：关闭全局练习模式
  const handleCloseGlobalTraining = () => {
    setTrainingMode(false)
    mutate(undefined, true)  // 🔴 强制重新验证，确保从数据库获取最新状态
  }

  const handleDeleteWord = async (wordId: string) => {
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
        mutate(undefined, true)  // 🔴 强制重新验证
      }
    } catch (error) {
      console.error('删除生词失败:', error)
    }
  }

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

  const getCurrentDefinition = (definitionStr: string): string => {
    const def = parseDefinition(definitionStr)
    return def[currentLanguage] || def['zh-CN'] || 'No definition'
  }

  const STATUS_CONFIG = {
    learning: { label: 'Learning', color: 'bg-blue-100 text-blue-800' },
    familiar: { label: 'Familiar', color: 'bg-yellow-100 text-yellow-800' },
    mastered: { label: 'Mastered', color: 'bg-green-100 text-green-800' }
  }

  // ============================================================
  // 🔴 第四阶段：渲染区（无条件渲染，所有逻辑已提前处理）
  // ============================================================

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
              <button
                onClick={() => setTrainingMode(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Start Training
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
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
              {dueCount > 0 && (
                <span className="ml-1.5 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {dueCount}
                </span>
              )}
              {dueCount === 0 && (
                <span className="ml-1.5 text-xs text-gray-400">(0)</span>
              )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {words.map((userWord) => {
            const definition = parseDefinition(userWord.definition)
            const statusConfig = STATUS_CONFIG[userWord.mastery_status] || STATUS_CONFIG.learning

            const now = new Date()
            const isCoolingDown = userWord.mastery_status === 'learning' &&
              userWord.next_review_at &&
              new Date(userWord.next_review_at) > now

            return (
              <div
                key={userWord.id}
                onClick={(e) => handleWordCardClick(userWord, e)}
                className={`bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:shadow-md transition-all cursor-pointer hover:border-blue-300 ${
                  isCoolingDown ? 'opacity-50' : ''
                }`}
                title="点击练习此单词"
              >
                {/* 单词和音标 */}
                <div className="mb-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-bold text-gray-900">
                      {userWord.word}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteWord(userWord.id)
                      }}
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
                      {userWord.dictionary_cache?.audio_url_us && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            playAudio(userWord.dictionary_cache!.audio_url_us!)
                          }}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors text-xs font-medium"
                          title="US pronunciation (美音)"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                          </svg>
                          <span>US</span>
                        </button>
                      )}
                      {userWord.dictionary_cache?.audio_url_uk && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            playAudio(userWord.dictionary_cache!.audio_url_uk!)
                          }}
                          className="flex items-center gap-1 text-purple-600 hover:text-purple-700 transition-colors text-xs font-medium"
                          title="UK pronunciation (英音)"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                          </svg>
                          <span>UK</span>
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
      </div>

      {/* 训练遮罩层 */}
      {/* 全局练习模式 */}
      {trainingMode && (
        <ReviewOverlay
          user={user}
          words={words.map(w => ({
            id: w.id,
            word: w.word,
            phonetic: w.phonetic || '',
            definition: w.definition,
            context_sentence: w.context_sentence || '',
            audio_url_us: w.dictionary_cache?.audio_url_us || undefined,
            audio_url_uk: w.dictionary_cache?.audio_url_uk || undefined
          }))}
          onClose={handleCloseGlobalTraining}
        />
      )}

      {/* 🔴 单点练习模式 */}
      {singleWordTraining && (
        <ReviewOverlay
          user={user}
          words={[{
            id: singleWordTraining.id,
            word: singleWordTraining.word,
            phonetic: singleWordTraining.phonetic || '',
            definition: singleWordTraining.definition,
            context_sentence: singleWordTraining.context_sentence || '',
            audio_url_us: singleWordTraining.dictionary_cache?.audio_url_us || undefined,
            audio_url_uk: singleWordTraining.dictionary_cache?.audio_url_uk || undefined
          }]}
          onClose={handleCloseSingleTraining}
        />
      )}
    </div>
  )
}
