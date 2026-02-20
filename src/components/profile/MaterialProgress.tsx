/**
 * Material Progress Component
 *
 * 显示用户练习的素材进度，分为"已完成"和"进行中"两个部分
 */

'use client'

import { useState } from 'react'
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
}

function MaterialCard({ material, isCompleted }: MaterialCardProps) {
  const total = material.totalSentences
  const completed = material.completedSentences
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  // 使用真实的缩略图，如果没有则使用 placeholder
  const coverImage = material.thumbnail || `https://placehold.co/80x80/e0e7ff/4f46e5?text=${encodeURIComponent(material.audioTitle.slice(0, 2))}`

  return (
    <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
      <div className="flex gap-4">
        {/* 封面图 */}
        <div className="flex-shrink-0">
          <img
            src={coverImage}
            alt={material.audioTitle}
            className="w-16 h-16 rounded-lg object-cover"
          />
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
