"use client"

import { useLanguage } from "@/contexts/LanguageContext"
import { Languages } from "lucide-react"

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
      <Languages className="w-4 h-4 text-gray-600" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as "en" | "zh")}
        className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
      >
        <option value="en" className="text-gray-900">English</option>
        <option value="zh" className="text-gray-900">中文</option>
      </select>
    </div>
  )
}
