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
        <p className="text-gray-500">还没有练习记录</p>
        <p className="text-sm text-gray-400 mt-1">
          {practiceMode === 'dictation' ? '完成听写练习' : '完成影子跟读'}后会在这里显示
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
              {selectedTab === 'in-progress' ? '没有进行中的素材' : '没有已完成的素材'}
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

  // 计算跳转目标：下一句 = 已完成句子数
  // 如果已完成所有句子，回到第 1 句（索引 0）
  const targetIndex = completed >= total ? 0 : completed

  // 图片加载状态
  const [imageError, setImageError] = useState(false)

  // 处理卡片点击
  const handleClick = () => {
    if (!material.materialId) return

    // 构建跳转 URL
    const params = new URLSearchParams({
      id: material.materialId,
      mode: practiceMode,
      start: targetIndex.toString()
    })

    router.push(`/?${params.toString()}`)
  }

  // 构建 Supabase Storage 公开 URL
  const getThumbnailUrl = (thumbnailPath: string | null | undefined) => {
    if (!thumbnailPath) return null

    // 移除可能存在的 'thumbnails/' 前缀
    const filename = thumbnailPath.replace(/^thumbnails\//, '')

    // 构建完整的公开 URL
    return `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/thumbnails/${filename}`
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

  return (
    <div
      className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex gap-4">
        {/* 封面图 */}
        <div className="flex-shrink-0 w-16 h-16">
          {thumbnailUrl && !imageError ? (
            <img
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
                {completed}/{total} 句
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

          {/* 最后练习时间 */}
          <p className="text-xs text-gray-500">
            最后练习：{formatDate(new Date(material.lastPracticedAt))}
          </p>
        </div>
      </div>
    </div>
  )
}
