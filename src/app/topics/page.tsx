'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import FilterBar, { FilterOptions } from '@/components/topics/FilterBar'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'
import { useLanguage } from '@/contexts/LanguageContext'
import LocalizedLink from '@/components/LocalizedLink'
import { getSupabase } from '@/lib/supabase/client'  // 🔴 关键修复：使用 getSupabase() 而不是直接导入实例

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
  // 图片加载状态跟踪
  const [imageLoadedStates, setImageLoadedStates] = useState<Record<string, boolean>>({})
  // 🔴 关键修复：在组件顶部定义超时状态，避免在 map 循环中使用 useState
  const [imageTimeoutStates, setImageTimeoutStates] = useState<Record<string, boolean>>({})
  // 🔴 新增：首屏加载完成状态
  const [firstScreenLoaded, setFirstScreenLoaded] = useState(false)
  // 🔴 新增：预渲染下一批的素材 ID 集合
  const [preRenderMaterialIds, setPreRenderMaterialIds] = useState<Set<string>>(new Set())
  // 🔴 新增：动态渲染 - 控制每个分类显示的卡片数量
  const [visibleCardCounts, setVisibleCardCounts] = useState<Record<string, number>>({})

  // 更新图片加载状态的辅助函数
  const setImageLoaded = (materialId: string, loaded: boolean) => {
    setImageLoadedStates(prev => ({ ...prev, [materialId]: loaded }))
  }

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

        // 🔴 关键修复：使用单例模式获取 Supabase 客户端
        // 避免创建多个实例导致 GoTrueClient 冲突和加载卡死
        const supabaseClient = getSupabase()
        console.log('[Supabase] Using singleton instance for fetchMaterials')

        const result = await fetchWithRetry(async () => {
          return await supabaseClient
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
          // 🔴 iOS Safari 修复：将对象转换为字符串，避免"未能抓取属性"错误
          const errorMessage = error.message || '未知错误'
          const errorCode = error.code || 'N/A'
          const errorDetails = error.details || 'N/A'
          console.error('[Supabase Error]', {
            message: errorMessage,
            code: errorCode,
            details: errorDetails
          })
          setError(`错误: ${errorMessage} (${errorCode})`)
          throw error
        }

        console.log('获取到素材数量:', data?.length || 0)
        setMaterials(data || [])
        setError(null)
      } catch (err) {
        // 🔴 iOS Safari 修复：避免打印复杂对象
        const errMessage = err instanceof Error ? err.message : String(err)
        const errName = err instanceof Error ? err.name : 'Unknown'
        console.error('[Fetch Error]', { name: errName, message: errMessage })

        // 🔴 关键修复：捕获 TypeError 并提供友好的错误提示
        if (err instanceof TypeError && err.message.includes('Load failed')) {
          console.error('❌ TypeError: Load failed - 可能是网络连接或 CORS 问题')
          setError('网络连接不稳定，请检查网络后重试')
          return
        }

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

  // 🔴 关键修复 2：3秒强制解锁 - 全局处理图片超时
  // 🔴 暂时移除超时检查，让浏览器原生加载机制接管
  // useEffect(() => {
  //   const timeouts: NodeJS.Timeout[] = []

  //   // 为每个未加载的图片设置 3 秒超时
  //   filteredMaterials.forEach(material => {
  //     if (!imageLoadedStates[material.id] && !imageTimeoutStates[material.id]) {
  //       const timeoutId = setTimeout(() => {
  //         console.log('[MaterialCard] Image timeout (3s) for:', material.title)
  //         setImageTimeoutStates(prev => ({ ...prev, [material.id]: true }))
  //         setImageLoadedStates(prev => ({ ...prev, [material.id]: true })) // 强制停止加载指示器
  //       }, 3000)

  //       timeouts.push(timeoutId)
  //     }
  //   })

  //   // 清理所有超时器
  //   return () => {
  //     timeouts.forEach(clearTimeout)
  //   }
  // }, [filteredMaterials, imageLoadedStates, imageTimeoutStates])

  // 🔴 新增：预加载逻辑 - 首屏加载完成后预加载所有图片
  useEffect(() => {
    if (loading || filteredMaterials.length === 0) return

    // 计算首屏可见的图片数量（每个分类前4个）
    const getFirstScreenCount = () => {
      if (typeof window === 'undefined') return 4
      const width = window.innerWidth
      if (width < 640) return 1   // 移动端
      if (width < 1024) return 2  // 小屏
      if (width < 1280) return 3  // 中屏
      return 4 // 大屏
    }

    const firstScreenCount = getFirstScreenCount()
    const firstScreenMaterialIds = new Set<string>()

    // 收集首屏可见的素材 ID
    Object.entries(materialsByCategory).forEach(([categoryId, categoryMaterials]) => {
      categoryMaterials.slice(0, firstScreenCount).forEach(m => {
        firstScreenMaterialIds.add(m.id)
      })
    })

    // 检查首屏图片是否都已加载完成
    const firstScreenLoaded = firstScreenMaterialIds.size > 0 &&
      Array.from(firstScreenMaterialIds).every(id => imageLoadedStates[id])

    if (firstScreenLoaded && !firstScreenLoaded) {
      console.log('🖼️ 首屏图片加载完成，开始预加载剩余图片...')

      // 收集所有需要预加载的图片 URL（排除已加载的和没有缩略图的）
      const preloadUrls: string[] = []
      filteredMaterials.forEach(material => {
        if (!firstScreenMaterialIds.has(material.id) && material.thumbnail_path) {
          const url = getThumbnailUrl(material.thumbnail_path)
          if (url) preloadUrls.push(url)
        }
      })

      // 预加载图片（使用 new Image()）
      let loadedCount = 0
      const totalCount = preloadUrls.length

      console.log(`🖼️ 开始预加载 ${totalCount} 张图片...`)

      // 分批预加载，避免一次性抢占太多带宽
      const batchSize = 5 // 每批预加载5张
      let currentIndex = 0

      const loadBatch = () => {
        const batch = preloadUrls.slice(currentIndex, currentIndex + batchSize)
        currentIndex += batchSize

        batch.forEach(url => {
          const img = new Image()
          img.onload = () => {
            loadedCount++
            if (loadedCount === totalCount) {
              console.log(`✅ 预加载完成：${totalCount} 张图片`)
            }
          }
          img.onerror = () => {
            loadedCount++ // 即使失败也计数，避免阻塞
          }
          img.src = url
        })

        // 如果还有剩余图片，继续加载下一批
        if (currentIndex < preloadUrls.length) {
          // 延迟 100ms 再加载下一批，避免抢占带宽
          setTimeout(loadBatch, 100)
        }
      }

      // 启动分批预加载
      loadBatch()
      setFirstScreenLoaded(true)
    }
  }, [loading, filteredMaterials, materialsByCategory, imageLoadedStates, firstScreenLoaded])

  // 🔴 关键优化：监听卡片可见事件，预渲染下一批素材
  useEffect(() => {
    const handleMaterialCardVisible = (event: CustomEvent) => {
      const { materialId } = event.detail

      // 找到当前素材在所有素材中的索引
      const currentIndex = filteredMaterials.findIndex(m => m.id === materialId)
      if (currentIndex === -1) return

      // 预渲染接下来的 10 个素材
      const nextBatchSize = 10
      const nextBatchIds: string[] = []

      for (let i = 1; i <= nextBatchSize; i++) {
        const nextMaterial = filteredMaterials[currentIndex + i]
        if (nextMaterial && !preRenderMaterialIds.has(nextMaterial.id)) {
          nextBatchIds.push(nextMaterial.id)
        }
      }

      if (nextBatchIds.length > 0) {
        console.log('🔄 预渲染下一批素材:', nextBatchIds.length)
        setPreRenderMaterialIds(prev => new Set([...prev, ...nextBatchIds]))
      }
    }

    // 监听自定义事件
    window.addEventListener('materialCardVisible', handleMaterialCardVisible as EventListener)

    return () => {
      window.removeEventListener('materialCardVisible', handleMaterialCardVisible as EventListener)
    }
  }, [filteredMaterials, preRenderMaterialIds])

  // 🔴 初始化每个分类的默认可见卡片数量（前1个）
  useEffect(() => {
    if (!loading && filteredMaterials.length > 0) {
      const initialCounts: Record<string, number> = {}
      Object.entries(materialsByCategory).forEach(([categoryId, categoryMaterials]) => {
        // 每个分类默认显示前1个，或全部（如果少于1个）
        initialCounts[categoryId] = Math.min(1, categoryMaterials.length)
      })
      setVisibleCardCounts(initialCounts)
    }
  }, [loading, filteredMaterials, materialsByCategory])

  // 🔴 展开/收起切换处理函数
  const handleToggleExpand = (categoryId: string) => {
    const categoryMaterials = materialsByCategory[categoryId]
    if (!categoryMaterials) return

    const currentCount = visibleCardCounts[categoryId] || 1
    const isExpanded = currentCount === categoryMaterials.length

    setVisibleCardCounts(prev => ({
      ...prev,
      [categoryId]: isExpanded ? 1 : categoryMaterials.length // 切换：展开显示全部，收起只显示1个
    }))
  }


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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalFilteredCount = filteredMaterials.length;
  const totalCategoriesCount = Object.keys(materialsByCategory).filter(
    key => materialsByCategory[key].length > 0
  ).length;

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
              <span className="font-semibold text-gray-900">{totalCategoriesCount}</span>
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

                    {/* 🔴 展开/收起按钮 */}
                    {categoryMaterials.length > 1 && (
                      <button
                        onClick={() => handleToggleExpand(categoryId)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {(visibleCardCounts[categoryId] || 1) === categoryMaterials.length
                          ? t("topics.collapse")
                          : t("topics.loadMore")}
                      </button>
                    )}
                  </div>

                  {/* Card Grid - 始终使用网格布局 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* 🔴 使用可见数量限制 */}
                    {categoryMaterials.slice(0, visibleCardCounts[categoryId] || 1).map((material, index) => {
                      // 🔴 使用绝对路径，不走代理
                      const thumbnailUrl = material.thumbnail_path
                        ? `https://media.shadowhub.app/${material.thumbnail_path}`
                        : null

                      // 🔴 图片加载优化：第一张图片优先加载，其他图片懒加载
                      const isFirstImage = index === 0
                      const shouldLazyLoad = !isFirstImage

                      return (
                        <div
                          key={material.id}
                          className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 group"
                        >
                          {/* 统一纵向卡片布局，支持弹性缩放 */}
                          <div className="flex flex-col">
                            {/* 缩略图 */}
                            <div className="w-full relative aspect-video min-h-[180px] bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                              {thumbnailUrl ? (
                                <img
                                  crossOrigin="anonymous"
                                  src={thumbnailUrl}
                                  alt={material.title}
                                  className="w-full h-full object-cover"
                                  loading={shouldLazyLoad ? "lazy" : "eager"}
                                  fetchPriority={isFirstImage ? "high" : "auto"}
                                  onLoad={() => {
                                    if (isFirstImage) {
                                      console.log('🔍 [DEBUG] 第一张图片加载成功:', {
                                        title: material.title,
                                        url: thumbnailUrl,
                                        category: categoryId
                                      })
                                    }
                                  }}
                                />
                              ) : null}

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
                                  href={`/topics/${categoryToSlug(material.category)}/${titleToSlug(material.title)}?mode=dictation`}
                                  className="flex-1 text-center px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                >
                                  {t("topics.dictation")}
                                </LocalizedLink>
                                <LocalizedLink
                                  href={`/topics/${categoryToSlug(material.category)}/${titleToSlug(material.title)}?mode=shadowing`}
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
