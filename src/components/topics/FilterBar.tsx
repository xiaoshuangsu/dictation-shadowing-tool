'use client'

import { useState } from 'react'
import DifficultySelector from './DifficultySelector'
import { useLanguage } from '@/contexts/LanguageContext'

// 筛选选项类型
export type FilterOptions = {
  difficulty: string | null
  duration: string | null
  category: string | null
}

interface FilterBarProps {
  categories: string[]
  onFilterChange: (filters: FilterOptions) => void
}

export default function FilterBar({ categories, onFilterChange }: FilterBarProps) {
  const { t, language } = useLanguage()
  const [filters, setFilters] = useState<FilterOptions>({
    difficulty: null,
    duration: null,
    category: null,
  })

  // Duration 下拉状态
  const [isDurationOpen, setIsDurationOpen] = useState(false)
  // Category 下拉状态
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)

  // 分类映射
  const CATEGORY_MAP = {
    '故事': { en: 'Stories', zh: '故事' },
    'TED演讲': { en: 'TED Talks', zh: 'TED演讲' },
    '历史演讲': { en: 'Historical Speeches', zh: '历史演讲' },
    '日常生活': { en: 'Daily Life', zh: '日常生活' },
    '艺术文化': { en: 'Arts & Culture', zh: '艺术文化' },
    '文化历史': { en: 'Culture & History', zh: '文化历史' },
    'BBC Learning English': { en: 'BBC Learning English', zh: 'BBC Learning English' },
    'VOA Learning English': { en: 'VOA Learning English', zh: 'VOA Learning English' },
    '动画片': { en: 'Cartoons', zh: '动画片' },
  }

  // 构建话题选项（动态，使用映射）
  const categoryOptions = [
    { value: null, label: t("topics.filter.all") },
    ...categories.map(cat => ({
      value: cat,
      label: CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]?.[language] || cat
    })),
  ]

  // 时长选项（使用翻译）
  const DURATION_OPTIONS = [
    { value: null, label: t("topics.filter.all") },
    { value: 'short', label: t("topics.filter.short") },
    { value: 'medium', label: t("topics.filter.medium") },
    { value: 'long', label: t("topics.filter.long") },
  ]

  // 更新筛选条件
  const updateFilter = (key: keyof FilterOptions, value: string | null) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  return (
    // 控制面板样式：白色背景、圆角、边框、阴影
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
      {/* 桌面端横向排列，移动端纵向堆叠 */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        {/* 难度筛选 */}
        <div className="flex-1 min-w-[200px]">
          <DifficultySelector
            value={filters.difficulty}
            onChange={(value) => updateFilter('difficulty', value)}
          />
        </div>

        {/* 时长筛选 */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {/* 时长图标 */}
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-gray-700">{t("topics.filter.duration")}</span>
            </div>
            <div className="relative min-w-[200px]">
              {/* 触发按钮 */}
              <button
                type="button"
                onClick={() => setIsDurationOpen(!isDurationOpen)}
                className="w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors flex items-center justify-between"
              >
                <span className="whitespace-nowrap">
                  {DURATION_OPTIONS.find(opt => opt.value === filters.duration)?.label || t("topics.filter.all")}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isDurationOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {isDurationOpen && (
                <div className="absolute z-[100] w-full min-w-[200px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      onClick={() => {
                        updateFilter('duration', option.value)
                        setIsDurationOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 text-sm text-left transition-colors whitespace-nowrap ${
                        filters.duration === option.value
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 话题筛选 */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {/* 话题图标 */}
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-xs font-medium text-gray-700">{t("topics.filter.category")}</span>
            </div>
            <div className="relative min-w-[200px]">
              {/* 触发按钮 */}
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors flex items-center justify-between"
              >
                <span className="whitespace-nowrap">
                  {categoryOptions.find(opt => opt.value === filters.category)?.label || t("topics.filter.all")}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isCategoryOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {isCategoryOpen && (
                <div className="absolute z-[100] w-full min-w-[200px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                  {categoryOptions.map((option) => (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      onClick={() => {
                        updateFilter('category', option.value)
                        setIsCategoryOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 text-sm text-left transition-colors whitespace-nowrap ${
                        filters.category === option.value
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
