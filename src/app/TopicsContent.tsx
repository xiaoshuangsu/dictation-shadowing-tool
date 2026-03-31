/**
 * Topics Page - 素材列表页
 *
 * 修复目标：
 * - 修复 React Error #310（Hook 顺序问题）
 * - 使用 SWR 全局缓存，实现瞬时加载
 * - 禁用自动重新验证，避免切换标签时重新加载
 * - 与 Vocabulary 页面保持一致的缓存策略
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { categoryToSlug } from '@/lib/utils/category'
import { titleToSlug } from '@/lib/utils/slug'
import { TrainingModeModal } from '@/components/topics/TrainingModeModal'
import { useMaterials, CATEGORIES } from '@/lib/hooks/useMaterials'

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

// 难度颜色映射
const DIFFICULTY_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-200',
  A2: 'bg-blue-100 text-blue-700 border-blue-200',
  B1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  B2: 'bg-red-100 text-red-700 border-red-200',
  C1: 'bg-purple-100 text-purple-700 border-purple-200',
  C2: 'bg-pink-100 text-pink-700 border-pink-200',
}

export function MaterialsPageContent() {
  // 🔴 所有 Hook 必须在组件顶部调用，不能有任何条件返回在 Hook 之前

  // 🔴 使用 SWR Hook 获取素材数据（全局缓存）
  const { materialsByCategory, categoryCounts, isLoading, error } = useMaterials()

  // 🔴 状态管理
  const [imageLoadedStates, setImageLoadedStates] = useState<Record<string, boolean>>({})

  // 🔴 弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)

  // R2 URL 配置
  const R2_WORKER_URL = 'https://media.shadowhub.app'

  // 获取缩略图 URL
  const getThumbnailUrl = (path: string | null) => {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    return `${R2_WORKER_URL}/${path}`
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return mb.toFixed(1)
  }

  // 格式化时长
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 🔴 打开弹窗
  const handleOpenModal = (material: Material, e?: React.MouseEvent) => {
    console.log('🔍 [TopicsContent] handleOpenModal 被调用:', {
      title: material.title,
      hasEvent: !!e
    })

    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    setSelectedMaterial(material)
    setModalOpen(true)
  }

  // 🔴 关闭弹窗
  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedMaterial(null)
  }

  // 🔴 计算总素材数和分类数
  const totalMaterials = Object.values(materialsByCategory).reduce((sum, materials) => sum + materials.length, 0)
  const totalCategories = Object.keys(materialsByCategory).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            English Dictation & Shadowing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Curated English learning materials covering daily life, culture & history, historical speeches, and more. Choose content that matches your level and start practicing!
          </p>

          {/* 统计信息 */}
          <div className="mt-6 flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{totalMaterials}+</span>
              <span>materials</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{totalCategories}</span>
              <span>categories</span>
            </div>
          </div>
        </div>
      </div>

      {/* 素材列表（按分类分组） */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          {isLoading && Object.keys(materialsByCategory).length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-16 w-16 text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Failed to load materials</h3>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <div className="space-y-12">
              {CATEGORIES.map((category) => {
                const categoryMaterials = materialsByCategory[category.id] || []

                if (categoryMaterials.length === 0) return null

                return (
                  <section key={category.id} className="scroll-mt-4">
                    {/* Section Header - 点击分类标题跳转到分类页面 */}
                    <div className="flex items-center justify-between mb-6">
                      <Link
                        href={`/topics/${categoryToSlug(category.id)}`}
                        className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {category.label}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({categoryCounts[category.id] || 0} materials)
                        </span>
                      </Link>
                      <Link
                        href={`/topics/${categoryToSlug(category.id)}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All →
                      </Link>
                    </div>

                    {/* Card Grid - 显示前4个素材 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {categoryMaterials.map((material, index) => {
                        // 移动端只显示第一个卡片，桌面端显示所有卡片
                        const isHiddenOnMobile = index > 0
                        const thumbnailUrl = getThumbnailUrl(material.thumbnail_path)
                        const imageLoaded = imageLoadedStates[material.id] || false

                        return (
                          <div
                            key={material.id}
                            className={`bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 group ${
                              isHiddenOnMobile ? 'hidden sm:block' : ''
                            }`}
                          >
                            {/* 缩略图 */}
                            <div className="w-full relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                              {thumbnailUrl ? (
                                <img
                                  crossOrigin="anonymous"
                                  src={thumbnailUrl}
                                  alt={material.title}
                                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                                    imageLoaded ? 'opacity-100' : 'opacity-0'
                                  }`}
                                  loading="lazy"
                                  onLoad={() => {
                                    setImageLoadedStates(prev => ({ ...prev, [material.id]: true }))
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                  <svg className="w-12 h-12 text-blue-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                              <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-2 md:mb-3 line-clamp-2 min-h-[2.5rem]">
                                {material.title}
                              </h3>

                              {/* 🔴 操作按钮（改成按钮，添加弹窗） */}
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => handleOpenModal(material, e)}
                                  className="flex-1 text-center px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                >
                                  Dictation
                                </button>
                                <button
                                  onClick={(e) => handleOpenModal(material, e)}
                                  className="flex-1 text-center px-2 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                                >
                                  Shadowing
                                </button>
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

      {/* 🔴 训练模式选择弹窗 */}
      {selectedMaterial && (
        <TrainingModeModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          material={{
            id: selectedMaterial.id,
            title: selectedMaterial.title,
            category: selectedMaterial.category,
            slug: selectedMaterial.slug || titleToSlug(selectedMaterial.title),
            audio_path: selectedMaterial.audio_path
          }}
        />
      )}
    </div>
  )
}
