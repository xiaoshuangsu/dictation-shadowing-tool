'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import FilterBar, { FilterOptions } from '@/components/materials/FilterBar'

// 硬编码 Supabase 配置
const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

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
}

// 分类顺序和配置
const CATEGORIES = [
  { id: '日常生活', label: '日常生活' },
  { id: '历史演讲', label: '历史演讲' },
  { id: '文化历史', label: '文化历史' },
  { id: '艺术文化', label: '艺术文化' },
]

// 难度颜色映射
const DIFFICULTY_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-200',
  A2: 'bg-blue-100 text-blue-700 border-blue-200',
  B1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  B2: 'bg-red-100 text-red-700 border-red-200',
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterOptions>({
    difficulty: null,
    duration: null,
    category: null,
  })

  // 动态获取所有不重复的分类
  const uniqueCategories = useMemo(() => {
    const categories = new Set(materials.map(m => m.category))
    return Array.from(categories).sort()
  }, [materials])

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .order('category')
          .order('title')

        if (error) throw error
        setMaterials(data || [])
      } catch (error) {
        console.error('获取素材失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMaterials()
  }, [])

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

  // 获取缩略图 URL
  const getThumbnailUrl = (path: string | null) => {
    if (!path) return null
    return `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${path}`
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 返回主页链接 */}
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回练习
          </Link>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            English Dictation & Shadowing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            精选英语学习素材，涵盖日常生活、文化历史、历史演讲等多个主题。
            选择适合你难度的内容，开始练习吧！
          </p>

          {/* 统计信息 */}
          <div className="mt-6 flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{totalFilteredCount}</span>
              <span>个素材</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{totalCategories}</span>
              <span>个分类</span>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 + 素材列表：共用同一个容器 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 筛选栏 */}
        {!loading && (
          <div className="mb-10">
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
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : totalFilteredCount === 0 ? (
          /* 无结果提示 */
          <div className="text-center py-16">
            <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">未找到符合条件的素材</h3>
            <p className="text-gray-500">请尝试更改筛选条件</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(materialsByCategory).map(([categoryId, categoryMaterials]) => {
              if (categoryMaterials.length === 0) return null

              const categoryConfig = CATEGORIES.find(c => c.id === categoryId)
              const categoryLabel = categoryConfig?.label || categoryId

              const isExpanded = expandedCategories.has(categoryId)
              const displayedMaterials = isExpanded
                ? categoryMaterials
                : categoryMaterials.slice(0, 4) // 默认只显示4个

              return (
                <section key={categoryId} id={categoryId}>
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {categoryLabel}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({categoryMaterials.length}节课)
                      </span>
                    </h2>
                    {categoryMaterials.length > 4 && (
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
                        {isExpanded ? '收起 ↑' : `查看全部 →`}
                      </button>
                    )}
                  </div>

                  {/* Card Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {displayedMaterials.map((material) => {
                      const thumbnailUrl = getThumbnailUrl(material.thumbnail_path)

                      return (
                        <div
                          key={material.id}
                          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                        >
                          {/* 图片区域 */}
                          <div className="relative aspect-[3/2] bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                            {thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={material.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </div>
                            )}

                            {/* 左上角：难度标签 */}
                            <div className="absolute top-3 left-3">
                              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 ${DIFFICULTY_COLORS[material.difficulty]}`}>
                                {material.difficulty}
                              </span>
                            </div>

                            {/* 右下角：播放时长 */}
                            {material.duration && (
                              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded text-xs font-medium">
                                {formatDuration(material.duration)}
                              </div>
                            )}
                          </div>

                          {/* 内容区域 */}
                          <div className="p-4">
                            {/* 标题 */}
                            <h3 className="font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed mb-3">
                              {material.title}
                            </h3>

                            {/* 操作按钮 */}
                            <div className="flex gap-2">
                              <Link
                                href={`/?id=${material.id}&mode=dictation`}
                                className="flex-1 text-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                听写
                              </Link>
                              <Link
                                href={`/?id=${material.id}&mode=shadowing`}
                                className="flex-1 text-center px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                              >
                                影子
                              </Link>
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
