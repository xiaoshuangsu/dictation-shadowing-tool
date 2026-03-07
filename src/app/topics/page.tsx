'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import FilterBar, { FilterOptions } from '@/components/topics/FilterBar'
import { titleToSlug } from '@/lib/utils/slug'
import { useLanguage } from '@/contexts/LanguageContext'
import LocalizedLink from '@/components/LocalizedLink'
import { supabase } from '@/lib/supabase/client'

// 分类映射
const CATEGORY_MAP = {
  '日常生活': { en: 'Daily Life', zh: '日常生活' },
  '历史演讲': { en: 'Historical Speeches', zh: '历史演讲' },
  '文化历史': { en: 'Culture & History', zh: '文化历史' },
  '心灵故事': { en: 'Heart & Soul Stories', zh: '心灵故事' },
  '艺术文化': { en: 'Arts & Culture', zh: '艺术文化' },
  'YouTube Vlog': { en: 'YouTube Vlog', zh: 'YouTube Vlog' },
  '故事': { en: 'Stories', zh: '故事' },
  '人物访谈': { en: 'Interviews', zh: '人物访谈' },
  'BBC Learning English': { en: 'BBC Learning English', zh: 'BBC Learning English' },
  'VOA Learning English': { en: 'VOA Learning English', zh: 'VOA Learning English' },
  'TED演讲': { en: 'TED Talks', zh: 'TED演讲' },
  '动画片': { en: 'Cartoons', zh: '动画片' },
} as const

// 带重试的获取素材函数
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      console.warn(`第 ${attempt} 次尝试失败:`, error)

      if (attempt < maxRetries) {
        const delay = delayMs * attempt // 指数退避
        console.log(`等待 ${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

type Material = {
  id: string
  title: string
  category: string
  difficulty: 'A1' | 'A2' | 'B1' | 'B2'
  audio_path: string
  thumbnail_path: string | null
  audio_size: number
  duration: number | null
  play_count: number
  created_at: string
  updated_at: string
  video_path?: string | null
}

// 分类顺序和配置
const CATEGORIES = [
  { id: '日常生活', label: 'Daily Life' },
  { id: 'YouTube Vlog', label: 'YouTube Vlog' },
  { id: '历史演讲', label: 'Historical Speeches' },
  { id: 'TED演讲', label: 'TED Talks' },
  { id: '文化历史', label: 'Culture & History' },
  { id: '心灵故事', label: 'Heart & Soul Stories' },
  { id: '艺术文化', label: 'Arts & Culture' },
  { id: '故事', label: 'Stories' },
  { id: '动画片', label: 'Cartoons' },
  { id: '人物访谈', label: 'Interviews' },
  { id: 'BBC Learning English', label: 'BBC Learning English' },
  { id: 'VOA Learning English', label: 'VOA Learning English' },
]

// 难度颜色映射
const DIFFICULTY_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-200',
  A2: 'bg-blue-100 text-blue-700 border-blue-200',
  B1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  B2: 'bg-red-100 text-red-700 border-red-200',
  C1: 'bg-purple-100 text-purple-700 border-purple-200',
  C2: 'bg-pink-100 text-pink-700 border-pink-200',
}

export default function MaterialsPage() {
  const { t, language } = useLanguage()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterOptions>({
    difficulty: null,
    duration: null,
    category: null,
  })

  // 获取本地化的分类名称
  const getLocalizedCategory = (categoryId: string) => {
    return CATEGORY_MAP[categoryId as keyof typeof CATEGORY_MAP]?.[language] || categoryId
  }

  // 动态获取所有不重复的分类
  const uniqueCategories = useMemo(() => {
    const categories = new Set(materials.map(m => m.category))
    return Array.from(categories).sort()
  }, [materials])

  useEffect(() => {
    // Skip data fetching during build time
    if (typeof window === 'undefined') return

    async function fetchMaterials() {
      try {
        console.log('=== 开始获取素材 ===')

        const result = await fetchWithRetry(async () => {
          return await supabase
            .from('materials')
            .select('*')
            .order('category')
            .order('title')
        })

        const { data, error, status, statusText } = result

        console.log('=== API 响应 ===')
        console.log('状态码:', status)
        console.log('状态文本:', statusText)
        console.log('错误:', error)
        console.log('数据数量:', data?.length || 0)

        if (error) {
          console.error('Supabase 错误详情:', {
            message: error.message || '未知错误',
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null,
            name: error.name || null,
          })
          setError(`错误: ${error.message || '未知错误'} ${error.code ? `(${error.code})` : ''}`)
          throw error
        }

        console.log('获取到素材数量:', data?.length || 0)
        setMaterials(data || [])
        setError(null)
      } catch (err) {
        console.error('获取素材失败:', err)
        // 安全地提取错误信息
        let errorMsg = '未知错误'
        if (err) {
          if (typeof err === 'string') {
            errorMsg = err
          } else if (err instanceof Error) {
            errorMsg = err.message
          } else if ((err as any).message) {
            errorMsg = (err as any).message
          } else {
            try {
              errorMsg = JSON.stringify(err)
            } catch {
              errorMsg = '无法解析的错误'
            }
          }
        }
        setError(`加载失败: ${errorMsg}`)
      } finally {
        setLoading(false)
      }
    }

    fetchMaterials()
  }, [])

  // 处理 URL hash 滚动到对应分类
  useEffect(() => {
    if (!loading && materials.length > 0) {
      const hash = window.location.hash.slice(1) // 移除 # 号
      if (hash) {
        // 等待 DOM 渲染完成
        setTimeout(() => {
          const element = document.getElementById(hash)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 100)
      }
    }
  }, [loading, materials])

  // 多维度过滤素材
  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      // 难度筛选
      if (filters.difficulty && material.difficulty !== filters.difficulty) {
        return false
      }

      // 时长筛选
      if (filters.duration && material.duration) {
        const durationMinutes = material.duration / 60
        if (filters.duration === 'short' && durationMinutes >= 1) {
          return false
        }
        if (filters.duration === 'medium' && (durationMinutes < 1 || durationMinutes > 3)) {
          return false
        }
        if (filters.duration === 'long' && durationMinutes <= 3) {
          return false
        }
      } else if (filters.duration && !material.duration) {
        // 如果选择了时长筛选但素材没有时长数据，则过滤掉
        return false
      }

      // 话题筛选
      if (filters.category && material.category !== filters.category) {
        return false
      }

      return true
    })
  }, [materials, filters])

  // 按分类分组（根据筛选结果动态调整）
  const materialsByCategory = useMemo(() => {
    const grouped: Record<string, Material[]> = {}

    // 如果选择了特定话题，只显示该分类
    if (filters.category) {
      grouped[filters.category] = filteredMaterials.filter(m => m.category === filters.category)
    } else {
      // 否则显示所有分类
      for (const category of CATEGORIES) {
        grouped[category.id] = filteredMaterials.filter(m => m.category === category.id)
      }
    }

    return grouped
  }, [filteredMaterials, filters.category])

  // R2 URL 配置（统一使用 Worker 代理）
  const R2_WORKER_URL = 'https://media.shadowhub.app'

  // 获取缩略图 URL
  const getThumbnailUrl = (path: string | null) => {
    if (!path) return null

    // 如果是完整 URL，直接使用
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // 相对路径：添加 Worker 域名
    return `${R2_WORKER_URL}/${path}`
  }

  // 格式化时长
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 计算总素材数（过滤后）
  const totalFilteredCount = filteredMaterials.length
  const totalCategories = Object.keys(materialsByCategory).filter(
    key => materialsByCategory[key].length > 0
  ).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t("topics.title")}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            {t("topics.subtitle")}
          </p>

          {/* 统计信息 */}
          <div className="mt-6 flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{totalFilteredCount}</span>
              <span>{t("topics.materials")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{totalCategories}</span>
              <span>{t("topics.categories")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 + 素材列表：共用同一个容器 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        {/* 筛选栏 */}
        {!loading && (
          <div className="mt-12 mb-10">
            <FilterBar
              categories={uniqueCategories}
              onFilterChange={setFilters}
            />
          </div>
        )}

        {/* 素材列表（按分类分组） */}
        <div className="py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t("topics.loading")}</p>
          </div>
        ) : error ? (
          /* 错误提示 */
          <div className="text-center py-16">
            <svg className="mx-auto h-16 w-16 text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">{t("topics.error")}</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              {t("topics.errorDetails")}
            </p>
          </div>
        ) : totalFilteredCount === 0 ? (
          /* 无结果提示 */
          <div className="text-center py-16">
            <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">{t("topics.noResults")}</h3>
            <p className="text-gray-500">{t("topics.tryChangingFilters")}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(materialsByCategory).map(([categoryId, categoryMaterials]) => {
              if (categoryMaterials.length === 0) return null

              const categoryConfig = CATEGORIES.find(c => c.id === categoryId)
              const categoryLabel = categoryConfig?.label || categoryId

              const isExpanded = expandedCategories.has(categoryId)

              // 根据屏幕大小决定默认显示数量
              const getDefaultDisplayCount = () => {
                if (typeof window === 'undefined') return 4
                const width = window.innerWidth
                if (width < 640) return 1  // 移动端
                if (width < 1024) return 2 // 小屏
                if (width < 1280) return 3 // 中屏
                return 4 // 大屏
              }

              const defaultCount = getDefaultDisplayCount()
              const displayedMaterials = isExpanded
                ? categoryMaterials
                : categoryMaterials.slice(0, defaultCount)

              return (
                <section key={categoryId} id={categoryId} className="scroll-mt-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {getLocalizedCategory(categoryId)}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({categoryMaterials.length} {t("topics.lessons")})
                      </span>
                    </h2>
                    {categoryMaterials.length > defaultCount && (
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedCategories)
                          if (newExpanded.has(categoryId)) {
                            newExpanded.delete(categoryId)
                          } else {
                            newExpanded.add(categoryId)
                          }
                          setExpandedCategories(newExpanded)
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {isExpanded ? t("topics.collapse") : t("topics.viewAll")}
                      </button>
                    )}
                  </div>

                  {/* Card Grid - 始终使用网格布局 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {displayedMaterials.map((material, index) => {
                      const thumbnailUrl = getThumbnailUrl(material.thumbnail_path)
                      // Fallback 到 Supabase Storage（仅当 thumbnail_path 是相对路径时）
                      const supabaseUrl = material.thumbnail_path && !material.thumbnail_path.startsWith('http')
                        ? `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${material.thumbnail_path}`
                        : null

                      const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
                        const img = e.currentTarget
                        const currentSrc = img.src

                        // 如果当前是 R2 URL，尝试 Supabase Storage
                        if (currentSrc.includes('r2-proxy') && supabaseUrl) {
                          img.src = supabaseUrl
                        } else if (currentSrc.includes('pub-') && currentSrc.includes('.r2.dev') && supabaseUrl) {
                          // R2 公共域名失败，尝试 Supabase Storage
                          img.src = supabaseUrl
                        } else {
                          // 都失败了，隐藏图片
                          img.style.display = 'none'
                        }
                      }

                      return (
                        <div
                          key={material.id}
                          className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 group"
                        >
                          {/* 统一纵向卡片布局，支持弹性缩放 */}
                          <div className="flex flex-col">
                            {/* 缩略图 */}
                            <div className="w-full relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                              {thumbnailUrl ? (
                                <img
                                  src={thumbnailUrl}
                                  alt={material.title}
                                  className="w-full h-full object-cover"
                                  onError={handleImageError}
                                  loading="lazy"
                                  decoding="async"
                                  crossOrigin="anonymous"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                  </svg>
                                </div>
                              )}

                              {/* 左上角：难度标签 */}
                              <div className="absolute top-2 left-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold border-2 ${DIFFICULTY_COLORS[material.difficulty]}`}>
                                  {material.difficulty}
                                </span>
                              </div>

                              {/* 右下角：播放时长 */}
                              {material.duration && (
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-xs font-medium">
                                  {formatDuration(material.duration)}
                                </div>
                              )}
                            </div>

                            {/* 内容区域 */}
                            <div className="p-3 flex flex-col justify-between">
                              {/* 标题 */}
                              <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-2 md:mb-3 line-clamp-1">
                                {material.title}
                              </h3>

                              {/* 操作按钮 */}
                              <div className="flex gap-2">
                                <LocalizedLink
                                  href={`/topics/dictation/${titleToSlug(material.title)}`}
                                  className="flex-1 text-center px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                >
                                  {t("topics.dictation")}
                                </LocalizedLink>
                                <LocalizedLink
                                  href={`/topics/shadowing/${titleToSlug(material.title)}`}
                                  className="flex-1 text-center px-2 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                                >
                                  {t("topics.shadowing")}
                                </LocalizedLink>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
