'use client'

import { useState, useRef, useEffect } from 'react'

interface DifficultyOption {
  value: string | null
  label: string
  icon: string
  color: string
}

interface DifficultySelectorProps {
  value: string | null
  onChange: (value: string | null) => void
}

// 难度选项配置
const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: null, label: 'All difficulties', icon: '🎓', color: 'text-gray-700' },
  { value: 'A1', label: 'A1 - Beginner', icon: '⭐', color: 'text-green-600' },
  { value: 'A2', label: 'A2 - Elementary', icon: '👑', color: 'text-blue-600' },
  { value: 'B1', label: 'B1 - Intermediate', icon: '🏆', color: 'text-yellow-600' },
  { value: 'B2', label: 'B2 - Upper Intermediate', icon: '🏅', color: 'text-orange-600' },
  { value: 'C1', label: 'C1 - Advanced', icon: '🔮', color: 'text-purple-600' },
  { value: 'C2', label: 'C2 - Proficient', icon: '💎', color: 'text-cyan-600' },
]

export default function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 获取当前选中的选项
  const selectedOption = DIFFICULTY_OPTIONS.find(opt => opt.value === value) || DIFFICULTY_OPTIONS[0]

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option: DifficultyOption) => {
    onChange(option.value)
    setIsOpen(false)
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-1.5">
        {/* 难度图标 */}
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-xs font-medium text-gray-700">视频难度</span>
      </div>

      <div ref={containerRef} className="relative min-w-[200px] w-full">
        {/* 触发按钮 */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex items-center justify-between"
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-base flex-shrink-0">{selectedOption.icon}</span>
            <span className={selectedOption.color}>{selectedOption.label}</span>
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 下拉菜单 */}
        {isOpen && (
          <div className="absolute z-[100] w-full min-w-[200px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full px-4 py-2.5 text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                  value === option.value
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                <span className="text-base flex-shrink-0">{option.icon}</span>
                <span className={value === option.value ? 'text-white' : option.color}>{option.label}</span>
                {value === option.value && (
                  <svg className="w-4 h-4 ml-auto text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
