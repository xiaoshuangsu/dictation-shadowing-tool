'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { getCategoryMetadataBySlug, categoryToSlug, slugToCategory } from '@/lib/utils/category'
import { getSupabase } from '@/lib/supabase/client'
import { titleToSlug } from '@/lib/utils/slug'
import DifficultySelector from './DifficultySelector'
import DurationSelector from './DurationSelector'

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
  slug?: string
}

const ITEMS_PER_PAGE = 20

// Difficulty color mapping
const DIFFICULTY_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-200',
  A2: 'bg-blue-100 text-blue-700 border-blue-200',
  B1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  B2: 'bg-red-100 text-red-700 border-red-200',
}

interface CategoryPageProps {
  categorySlug: string
}

export default function CategoryPage({ categorySlug }: CategoryPageProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const categoryMetadata = getCategoryMetadataBySlug(categorySlug)

  // Fetch materials for this category
  useEffect(() => {
    if (typeof window === 'undefined') return

    async function fetchMaterials() {
      try {
        const supabase = getSupabase()
        // 🔴 关键修复：使用 slugToCategory 获取中文名称，因为数据库存储的是中文
        const categoryName = slugToCategory(categorySlug)

        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .eq('category', categoryName)
          .order('title')

        if (error) throw error

        setMaterials(data || [])
      } catch (err) {
        console.error('Failed to fetch materials:', err)
        setError('Failed to load materials')
      } finally {
        setLoading(false)
      }
    }

    fetchMaterials()
  }, [categorySlug, categoryMetadata])

  // Filter materials by search, difficulty and duration
  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      // 搜索筛选（素材标题）
      if (searchQuery && !material.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // 难度筛选
      if (selectedDifficulty && material.difficulty !== selectedDifficulty) {
        return false
      }

      // 时长筛选
      if (selectedDuration && material.duration) {
        const durationMinutes = material.duration / 60
        if (selectedDuration === 'short' && durationMinutes >= 1) {
          return false
        }
        if (selectedDuration === 'medium' && (durationMinutes < 1 || durationMinutes > 3)) {
          return false
        }
        if (selectedDuration === 'long' && durationMinutes <= 3) {
          return false
        }
      } else if (selectedDuration && !material.duration) {
        // 如果选择了时长筛选但素材没有时长数据，则过滤掉
        return false
      }

      return true
    })
  }, [materials, searchQuery, selectedDifficulty, selectedDuration])

  // Pagination
  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentMaterials = filteredMaterials.slice(startIndex, endIndex)

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedDifficulty, selectedDuration])

  // Format helpers
  const formatFileSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return mb.toFixed(1)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getThumbnailUrl = (path: string | null) => {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    return `https://media.shadowhub.app/${path}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading materials...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Failed to load materials</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link href="/topics" className="text-blue-600 hover:text-blue-700">
                Topics
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 font-medium">{categoryMetadata?.name || categorySlug}</li>
          </ol>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{categoryMetadata?.icon}</span>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {categoryMetadata?.name || categorySlug}
              </h1>
              <p className="text-lg text-gray-600">
                {categoryMetadata?.description || `${filteredMaterials.length} materials to practice`}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{filteredMaterials.length}</span>
              <span>materials</span>
            </div>
            {searchQuery && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">"{searchQuery}"</span>
                <span>search</span>
              </div>
            )}
            {selectedDifficulty && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{selectedDifficulty}</span>
                <span>difficulty</span>
              </div>
            )}
            {selectedDuration && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {selectedDuration === 'short' ? '< 1min' :
                   selectedDuration === 'medium' ? '1-3min' :
                   selectedDuration === 'long' ? '> 3min' : ''}
                </span>
                <span>duration</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search Box - 左侧，占据剩余空间 */}
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search materials..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filters - 右侧，固定宽度 */}
            <div className="flex gap-3 flex-shrink-0">
              {/* Difficulty Filter */}
              <DifficultySelector
                value={selectedDifficulty}
                onChange={setSelectedDifficulty}
              />

              {/* Duration Filter */}
              <DurationSelector
                value={selectedDuration}
                onChange={setSelectedDuration}
              />
            </div>
          </div>
        </div>

        {/* Materials Grid */}
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-16">
            <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No materials found</h3>
            <p className="text-gray-500">Try changing search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {currentMaterials.map((material) => {
                const thumbnailUrl = getThumbnailUrl(material.thumbnail_path)

                return (
                  <div
                    key={material.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={material.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}

                      {/* Difficulty Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${DIFFICULTY_COLORS[material.difficulty]}`}>
                          {material.difficulty}
                        </span>
                      </div>

                      {/* Duration Badge */}
                      {material.duration && (
                        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium">
                          {formatDuration(material.duration)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2 min-h-[2.5rem]">
                        {material.title}
                      </h3>

                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span>{formatFileSize(material.audio_size)} MB</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Link
                          href={`/topics/${categorySlug}/${material.slug || titleToSlug(material.title)}?mode=dictation`}
                          className="flex-1 text-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Dictation
                        </Link>
                        <Link
                          href={`/topics/${categorySlug}/${material.slug || titleToSlug(material.title)}?mode=shadowing`}
                          className="flex-1 text-center px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Shadowing
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[40px] px-3 py-2 rounded-lg font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {/* Page Info */}
            <div className="text-center text-sm text-gray-600 mt-4">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredMaterials.length)} of {filteredMaterials.length} materials
            </div>
          </>
        )}
      </div>
    </div>
  )
}
