'use client'

import { useState, useEffect } from 'react'

// 筛选选项类型
export type FilterOptions = {
  difficulty: string | null
  duration: string | null
  category: string | null
}

// 难度选项
const DIFFICULTY_OPTIONS = [
  { value: null, label: '全部' },
  { value: 'A0', label: 'A0' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
  { value: 'ADV', label: 'ADV' },
]

// 时长选项
const DURATION_OPTIONS = [
  { value: null, label: '全部' },
  { value: 'short', label: '< 1分钟' },
  { value: 'medium', label: '1-3分钟' },
  { value: 'long', label: '> 3分钟' },
]

interface FilterBarProps {
  categories: string[]
  onFilterChange: (filters: FilterOptions) => void
}

export default function FilterBar({ categories, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    difficulty: null,
    duration: null,
    category: null,
  })

  // 构建话题选项（动态）
  const categoryOptions = [
    { value: null, label: '全部' },
    ...categories.map(cat => ({ value: cat, label: cat })),
  ]

  // 更新筛选条件
  const updateFilter = (key: keyof FilterOptions, value: string | null) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  return (
    <div className="flex flex-wrap gap-4 items-end bg-white rounded-lg p-4 mb-6">
      {/* 难度筛选 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {/* 难度图标 */}
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">视频难度</span>
        </div>
        <select
          value={filters.difficulty || ''}
          onChange={(e) => updateFilter('difficulty', e.target.value || null)}
          className="min-w-[120px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1rem',
          }}
        >
          {DIFFICULTY_OPTIONS.map(option => (
            <option key={option.value || 'all'} value={option.value || ''}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 时长筛选 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {/* 时长图标 */}
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">视频长度</span>
        </div>
        <select
          value={filters.duration || ''}
          onChange={(e) => updateFilter('duration', e.target.value || null)}
          className="min-w-[120px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1rem',
          }}
        >
          {DURATION_OPTIONS.map(option => (
            <option key={option.value || 'all'} value={option.value || ''}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 话题筛选 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {/* 话题图标 */}
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">视频话题</span>
        </div>
        <select
          value={filters.category || ''}
          onChange={(e) => updateFilter('category', e.target.value || null)}
          className="min-w-[120px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1rem',
          }}
        >
          {categoryOptions.map(option => (
            <option key={option.value || 'all'} value={option.value || ''}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
