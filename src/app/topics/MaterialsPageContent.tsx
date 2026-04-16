/**
 * MaterialsPageContent - Topics 页面展示组件（v30.4.2 优化）
 *
 * ✅ 重构目标（v30.4.0）：
 * - 纯展示组件：通过 Props 接收数据，不发起任何请求
 * - 移除 useMaterials Hook：消除客户端 SWR 请求
 * - 移除 Loading 状态：数据已由服务端预取
 *
 * 🔥 v30.4.2 图片加载优化：
 * - LCP 优化：首屏图片优先加载（priority={true}）
 * - 占位符优化：使用 blur placeholder 防止页面跳动
 * - 懒加载兜底：非首屏图片延迟加载
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { categoryToSlug } from '@/lib/utils/category'
import { titleToSlug } from '@/lib/utils/slug'
import { TrainingModeModal } from '@/components/topics/TrainingModeModal'

type Material = {
  id: string
  title: string
  category: string
  difficulty: 'A1' | 'A2' | 'B1' | 'B2'
  thumbnail_path: string | null
  slug?: string
  duration?: number | null
}

interface MaterialsPageContentProps {
  materialsByCategory: Record<string, Material[]>
  categoryCounts: Record<string, number>
  categories: Array<{ id: string; label: string }>
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

// 🔥 v30.4.2: 简单的灰色 placeholder (base64 encoded 1x1 gray PNG)
const GRAY_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function MaterialsPageContent({
  materialsByCategory,
  categoryCounts,
  categories
}: MaterialsPageContentProps) {
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

  // 格式化时长
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 🔴 打开弹窗
  const handleOpenModal = (material: Material, e?: React.MouseEvent) => {
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
          <div className="space-y-12">
            {categories.map((category, categoryIndex) => {
              // 🔥 v30.4.0: 从 props 获取数据，不再使用 SWR
              const categoryMaterials = materialsByCategory[category.id] || []

              if (categoryMaterials.length === 0) return null

              // 🔥 v30.4.2: 判断是否是首屏可见区域
              // 第一个分类的前 2 个卡片在首屏可见（移动端 1 个，桌面端 4 个）
              const isFirstCategory = categoryIndex === 0
              const isAboveFold = isFirstCategory && categoryIndex === 0

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
                        ({categoryCounts?.[category.id] || 0} materials)
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
                      // 🔥 v30.4.0: 防御性渲染 - 确保数据安全
                      if (!material) return null

                      // 移动端只显示第一个卡片，桌面端显示所有卡片
                      const isHiddenOnMobile = index > 0
                      const thumbnailUrl = getThumbnailUrl(material?.thumbnail_path)

                      // 🔥 v30.4.2: 判断是否需要优先加载
                      // 第一个分类的前 2 个卡片优先加载（确保首屏快速显示）
                      const isPriority = isFirstCategory && index < 2

                      return (
                        <div
                          key={material?.id || index}
                          className={`bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 group ${
                            isHiddenOnMobile ? 'hidden sm:block' : ''
                          }`}
                        >
                          {/* 缩略图 */}
                          <div className="w-full relative aspect-video bg-gray-100 overflow-hidden">
                            {thumbnailUrl ? (
                              <Image
                                src={thumbnailUrl}
                                alt={material?.title || 'Material'}
                                width={400}
                                height={225}
                                className="w-full h-full object-cover"
                                // 🔥 v30.4.2: 图片加载优化
                                priority={isPriority}  // 首屏图片优先加载
                                placeholder="blur"  // 使用 blur placeholder
                                blurDataURL={GRAY_PLACEHOLDER}  // 灰色占位符
                                loading={isPriority ? 'eager' : 'lazy'}  // 非首屏图片懒加载
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
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
            audio_path: null, // 🔥 v30.4.0: 音频路径由练习页面获取，列表页不传递
          }}
        />
      )}
    </div>
  )
}
