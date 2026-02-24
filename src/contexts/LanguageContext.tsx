"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type Language = "en" | "zh"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translations
const translations = {
  en: {
    // Navigation
    "nav.topics": "Topics",
    "nav.login": "Login",
    "nav.signup": "Sign Up",
    "nav.profile": "Profile",
    "nav.logout": "Logout",

    // Hero
    "hero.title": "Master English Through Dictation & Shadowing",
    "hero.subtitle": "Improve your listening and speaking skills with AI-powered practice tools",
    "hero.cta": "Start Learning Free",

    // Auth Modal
    "auth.title": "Unlock Your Learning Progress",
    "auth.subtitle": "Register to save practice records, track your progress, and view detailed statistics",
    "auth.feature1.title": "Auto-save Practice Records",
    "auth.feature1.desc": "Never lose your practice history",
    "auth.feature2.title": "View Detailed Statistics",
    "auth.feature2.desc": "Track accuracy, completion, and streaks",
    "auth.feature3.title": "Track Learning Progress",
    "auth.feature3.desc": "Monitor your improvement over time",
    "auth.signup": "Sign Up Free",
    "auth.login": "Log In",
    "auth.noCredit": "No credit card required • Start learning in seconds",
  },
  zh: {
    // Navigation
    "nav.topics": "素材",
    "nav.login": "登录",
    "nav.signup": "注册",
    "nav.profile": "个人中心",
    "nav.logout": "退出登录",

    // Hero
    "hero.title": "通过听写和跟读掌握英语",
    "hero.subtitle": "使用 AI 驱动的练习工具提高你的听说能力",
    "hero.cta": "免费开始学习",

    // Auth Modal
    "auth.title": "解锁您的学习进度",
    "auth.subtitle": "注册账号即可保存练习记录，追踪学习进度，查看详细统计数据",
    "auth.feature1.title": "自动保存练习记录",
    "auth.feature1.desc": "永不丢失练习历史",
    "auth.feature2.title": "查看详细统计数据",
    "auth.feature2.desc": "追踪准确率、完成度和连续记录",
    "auth.feature3.title": "追踪学习进度",
    "auth.feature3.desc": "监控您的进步",
    "auth.signup": "免费注册",
    "auth.login": "登录",
    "auth.noCredit": "无需信用卡 • 秒速开始学习",
  },
}

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    // Load saved language preference
    const saved = localStorage.getItem("language") as Language
    if (saved && (saved === "en" || saved === "zh")) {
      setLanguage(saved)
    }
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("language", lang)
  }

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations["en"]] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
