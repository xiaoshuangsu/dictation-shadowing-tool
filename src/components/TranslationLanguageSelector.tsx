'use client'

import { useState, useEffect, useRef } from 'react'
import { Languages, ChevronDown, X } from 'lucide-react'

export type TranslationLanguage = 'zh' | 'zh_hant' | 'vi' | 'ar' | 'de' | 'es' | 'ja' | 'ms' | 'ru' | 'tr' | 'el' | 'id' | 'ko' | 'pt' | 'th' | 'uk' | 'bn' | 'mn' | 'hi' | 'hide'

const LANGUAGE_OPTIONS = [
  { value: 'zh' as TranslationLanguage, label: '中文 (简体)' },
  { value: 'zh_hant' as TranslationLanguage, label: '中文 (繁體)' },
  { value: 'vi' as TranslationLanguage, label: 'Tiếng Việt' },
  { value: 'ar' as TranslationLanguage, label: 'العربية' },
  { value: 'de' as TranslationLanguage, label: 'Deutsch' },
  { value: 'es' as TranslationLanguage, label: 'Español' },
  { value: 'ja' as TranslationLanguage, label: '日本語' },
  { value: 'ms' as TranslationLanguage, label: 'Bahasa Melayu' },
  { value: 'ru' as TranslationLanguage, label: 'Русский' },
  { value: 'tr' as TranslationLanguage, label: 'Türkçe' },
  { value: 'el' as TranslationLanguage, label: 'Ελληνικά' },
  { value: 'id' as TranslationLanguage, label: 'Bahasa Indonesia' },
  { value: 'ko' as TranslationLanguage, label: '한국어' },
  { value: 'pt' as TranslationLanguage, label: 'Português' },
  { value: 'th' as TranslationLanguage, label: 'ภาษาไทย' },
  { value: 'uk' as TranslationLanguage, label: 'Українська' },
  { value: 'bn' as TranslationLanguage, label: 'বাংলা' },
  { value: 'mn' as TranslationLanguage, label: 'Монгол' },
  { value: 'hi' as TranslationLanguage, label: 'हिन्दी' },
  { value: 'hide' as TranslationLanguage, label: '隐藏 (Hide)' }
]

const STORAGE_KEY = 'translation-language-preference'
const STORAGE_KEY_SHOW = 'translation-show-preference'

interface TranslationLanguageSelectorProps {
  onLanguageChange?: (language: TranslationLanguage, showTranslation: boolean) => void
}

export function getStoredLanguage(): TranslationLanguage {
  if (typeof window === 'undefined') return 'zh'

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const showStored = localStorage.getItem(STORAGE_KEY_SHOW)

    // 如果用户之前选择了隐藏，默认为中文
    if (showStored === 'false') {
      return 'zh'
    }

    if (stored && ['zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el', 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi', 'hide'].includes(stored)) {
      return stored as TranslationLanguage
    }
  } catch (e) {
    console.error('Failed to read stored language preference:', e)
  }

  return 'zh'
}

export function getStoredShowTranslation(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem(STORAGE_KEY_SHOW)
    return stored === 'true'
  } catch (e) {
    console.error('Failed to read stored show preference:', e)
  }

  return false
}

export function setStoredLanguage(language: TranslationLanguage, show: boolean): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, language)
    localStorage.setItem(STORAGE_KEY_SHOW, String(show))
  } catch (e) {
    console.error('Failed to store language preference:', e)
  }
}

export function TranslationLanguageSelector({ onLanguageChange }: TranslationLanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<TranslationLanguage>(getStoredLanguage())
  const [currentLanguage, setCurrentLanguage] = useState<TranslationLanguage>(getStoredLanguage())
  const [showTranslation, setShowTranslation] = useState(getStoredShowTranslation())
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false)
        setIsDropdownOpen(false)
      }
    }

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPanelOpen])

  // 处理语言选择（下拉框）
  const handleSelectLanguage = (language: TranslationLanguage) => {
    setSelectedLanguage(language)
    setIsDropdownOpen(false)
  }

  // 处理 Translate 按钮
  const handleTranslate = () => {
    const newShowTranslation = selectedLanguage !== 'hide'
    const newLanguage = selectedLanguage === 'hide' ? currentLanguage : selectedLanguage

    setShowTranslation(newShowTranslation)
    setCurrentLanguage(newLanguage)
    setStoredLanguage(newLanguage, newShowTranslation)
    setIsPanelOpen(false)

    if (onLanguageChange) {
      onLanguageChange(newLanguage, newShowTranslation)
    }
  }

  // 获取当前显示的标签
  const getCurrentLabel = () => {
    if (!showTranslation) return '翻译'
    return LANGUAGE_OPTIONS.find(opt => opt.value === currentLanguage)?.label || '中文 (简体)'
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* 图标按钮 */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="inline-flex items-center justify-center p-1 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md shadow-sm transition-all"
        title="翻译设置"
      >
        <Languages className="w-3 h-3 text-gray-500" />
      </button>

      {/* 悬浮面板 */}
      {isPanelOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
          {/* 语言选择框 */}
          <div className="mb-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span>{LANGUAGE_OPTIONS.find(opt => opt.value === selectedLanguage)?.label}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* 下拉菜单 */}
              {isDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSelectLanguage(option.value)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                        selectedLanguage === option.value ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Translate 按钮 */}
          <button
            onClick={handleTranslate}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Translate
          </button>
        </div>
      )}
    </div>
  )
}
