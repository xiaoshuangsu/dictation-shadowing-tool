/**
 * Material Progress Component
 *
 * 显示用户练习的素材进度，分为"已完成"和"进行中"两个部分
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MaterialProgress } from '@/lib/supabase/client'
import { formatDate } from '@/utils/analytics'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'

interface MaterialProgressListProps {
  materials: MaterialProgress[]
  practiceMode: 'dictation' | 'shadowing'
}

export default function MaterialProgressList({ materials, practiceMode }: MaterialProgressListProps) {
  // Tab 状态：in-progress | completed
  const [selectedTab, setSelectedTab] = useState<'in-progress' | 'completed'>('in-progress')

  // 分类：已完成 vs 进行中
  const completed = materials.filter(m => m.totalSentences > 0 && m.completedSentences >= m.totalSentences)
  const inProgress = materials.filter(m => m.totalSentences > 0 && m.completedSentences < m.totalSentences)

  // 根据Tab选择显示内容
  const displayMaterials = selectedTab === 'in-progress' ? inProgress : completed

  if (materials.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500">No practice records yet</p>
        <p className="text-sm text-gray-400 mt-1">
          {practiceMode === 'dictation' ? 'Complete dictation exercises' : 'Complete shadowing exercises'} to see them here
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Tab 切换按钮 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedTab('in-progress')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              selectedTab === 'in-progress'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            In Progress ({inProgress.length})
          </button>
          <button
            onClick={() => setSelectedTab('completed')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              selectedTab === 'completed'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed ({completed.length})
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {displayMaterials.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {selectedTab === 'in-progress' ? 'No materials in progress' : 'No completed materials'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayMaterials.map(material => (
              <MaterialCard
                key={material.audioTitle}
                material={material}
                isCompleted={selectedTab === 'completed'}
                practiceMode={practiceMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface MaterialCardProps {
  material: MaterialProgress
  isCompleted: boolean
  practiceMode: 'dictation' | 'shadowing'
}

function MaterialCard({ material, isCompleted, practiceMode }: MaterialCardProps) {
  const router = useRouter()

  const total = material.totalSentences
  const completed = material.completedSentences
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  // 展开状态
  const [isExpanded, setIsExpanded] = useState(false)

  // 计算跳转目标：下一句 = 已完成句子数
  // 如果已完成所有句子，回到第 1 句（索引 0）
  const targetIndex = completed >= total ? 0 : completed

  // 图片加载状态
  const [imageError, setImageError] = useState(false)

  // 处理卡片点击
  const handleClick = () => {
    // 使用 titleToSlug 和 categoryToSlug 生成路由参数
    const slug = titleToSlug(material.audioTitle)
    const categorySlug = categoryToSlug(material.category || '未分类')
    if (!slug) return

    // 根据练习模式构建正确的路由（统一使用 ?mode 参数）
    const basePath = `/topics/${categorySlug}/${slug}?mode=${practiceMode}`

    // 如果需要从特定句子开始，添加 URL 参数
    const url = targetIndex > 0
      ? `${basePath}&start=${targetIndex}`
      : basePath

    console.log('MaterialCard - Navigating to:', url)
    console.log('  - audioTitle:', material.audioTitle)
    console.log('  - category:', material.category)
    console.log('  - categorySlug:', categorySlug)
    console.log('  - slug:', slug)
    console.log('  - targetIndex:', targetIndex)
    router.push(url)
  }

  // 构建 Worker 代理 URL（统一使用 media.shadowhub.app）
  const R2_WORKER_URL = 'https://media.shadowhub.app'

  const getThumbnailUrl = (thumbnailPath: string | null | undefined) => {
    if (!thumbnailPath) return null

    // 如果已经是完整 URL（R2 Worker 或其他 CDN），直接使用
    if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
      return thumbnailPath
    }

    // 移除可能存在的 'thumbnails/' 前缀
    const filename = thumbnailPath.replace(/^thumbnails\//, '')

    // 使用 Worker 代理访问
    return `${R2_WORKER_URL}/thumbnails/${filename}`
  }

  const thumbnailUrl = getThumbnailUrl(material.thumbnail)

  // 生成素材的首字母缩写（备用方案）
  const getInitials = (title: string) => {
    const words = title.split(' ').filter(w => w.length > 0)
    if (words.length === 0) return 'M'
    if (words.length === 1) return words[0].charAt(0).toUpperCase()
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
  }

  const initials = getInitials(material.audioTitle)
  const bgColor = isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'

  // 计算缺失的句子ID
  const missingIds = material.sentenceIds
    ? Array.from({ length: total }, (_, i) => i + 1).filter(id => !material.sentenceIds!.includes(id))
    : []

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      {/* 主卡片区域 */}
      <div
        className="p-4 hover:bg-gray-100 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex gap-4">
          {/* 封面图 */}
          <div className="flex-shrink-0 w-16 h-16">
            {thumbnailUrl && !imageError ? (
              <img
                crossOrigin="anonymous"
                src={thumbnailUrl}
                alt={material.audioTitle}
                className="w-16 h-16 rounded-lg object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              // 备用：首字母占位符
              <div className={`w-16 h-16 rounded-lg ${bgColor} flex items-center justify-center text-lg font-bold`}>
                {initials}
              </div>
            )}
          </div>

          {/* 内容区域 */}
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <h4 className="font-medium text-gray-900 mb-2 truncate">
              {material.audioTitle}
            </h4>

            {/* 进度条 */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">
                  {completed}/{total} sentences
                </span>
                <span className={`text-xs font-medium ${
                  isCompleted ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isCompleted ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Last Practice Time */}
            <p className="text-xs text-gray-500">
              Last practiced: {formatDate(new Date(material.lastPracticedAt))}
            </p>
          </div>

          {/* 展开/收起图标 */}
          <div className="flex items-center">
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          {/* Completed Sentence IDs */}
          <div className="mt-3">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Completed sentences:</h5>
            <div className="flex flex-wrap gap-1">
              {material.sentenceIds?.map(id => (
                <span
                  key={id}
                  className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
                >
                  {id}
                </span>
              )) || <span className="text-xs text-gray-500">No data</span>}
            </div>
          </div>

          {/* Missing Sentence IDs */}
          {missingIds.length > 0 && (
            <div className="mt-3">
              <h5 className="text-sm font-medium text-red-700 mb-2">
                Incomplete sentences (click to jump):
              </h5>
              <div className="flex flex-wrap gap-1">
                {missingIds.map(id => (
                  <button
                    key={id}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Jump to specific sentence (index = id - 1)
                      const slug = titleToSlug(material.audioTitle)
                      const categorySlug = categoryToSlug(material.category || '未分类')
                      if (!slug) return

                      const basePath = `/topics/${categorySlug}/${slug}?mode=${practiceMode}`
                      const url = `${basePath}&start=${id - 1}`
                      console.log('Missing sentence - Navigating to:', url)
                      console.log('  - audioTitle:', material.audioTitle)
                      console.log('  - category:', material.category)
                      console.log('  - categorySlug:', categorySlug)
                      console.log('  - slug:', slug)
                      router.push(url)
                    }}
                    className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors cursor-pointer"
                  >
                    Sentence {id}
                  </button>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2">
                💡 Click a sentence number to jump directly to practice
              </p>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
            className="mt-3 w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Continue Practice
          </button>
        </div>
      )}
    </div>
  )
}
