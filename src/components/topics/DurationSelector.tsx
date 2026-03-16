'use client'

import { useState, useRef, useEffect } from 'react'

interface DurationOption {
  value: string | null
  label: string
  icon: string
}

interface DurationSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
}

export default function DurationSelector({ value, onChange }: DurationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 时长选项配置
  const DURATION_OPTIONS: DurationOption[] = [
    { value: null, label: "All Durations", icon: '⏱️' },
    { value: 'short', label: "Short (< 1min)", icon: '⚡' },
    { value: 'medium', label: "Medium (1-3min)", icon: '⏰' },
    { value: 'long', label: "Long (> 3min)", icon: '⏳' },
  ]

  // 获取当前选中的选项
  const selectedOption = DURATION_OPTIONS.find(opt => opt.value === value) || DURATION_OPTIONS[0]

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

  const handleSelect = (option: DurationOption) => {
    onChange(option.value)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full md:min-w-[180px]">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex items-center justify-between"
      >
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-base flex-shrink-0">{selectedOption.icon}</span>
          <span className="text-gray-700">{selectedOption.label}</span>
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
        <div className="absolute z-[100] w-full md:min-w-[180px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[60vh] overflow-y-auto">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              onClick={() => handleSelect(option)}
              className={`w-full px-4 py-3 text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                value === option.value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-blue-50'
              }`}
            >
              <span className="text-base flex-shrink-0">{option.icon}</span>
              <span>{option.label}</span>
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
  )
}
