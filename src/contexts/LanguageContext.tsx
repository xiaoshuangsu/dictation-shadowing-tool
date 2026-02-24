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
    "nav.brand": "ShadowHub",

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
    "auth.close": "Close",

    // How It Works
    "how.title": "How It Works",
    "how.subtitle": "Only 4 steps, making English practice easier and more enjoyable",
    "how.step1.title": "Choose Material",
    "how.step1.desc": "Select from our curated collection of English audio materials",
    "how.step2.title": "Select Mode",
    "how.step2.desc": "Choose between Dictation or Shadowing practice mode",
    "how.step3.title": "Practice",
    "how.step3.desc": "Listen and practice at your own pace with AI assistance",
    "how.step4.title": "Track Progress",
    "how.step4.desc": "View your statistics and monitor your improvement over time",

    // Features
    "features.title": "Powerful Features for Effective Learning",
    "feature.dictation.title": "Word-by-Word Dictation, Precise Improvement",
    "feature.dictation.desc": "Strengthen English listening comprehension through word-by-word dictation training.",
    "feature.dictation.word": "Word Mode",
    "feature.dictation.wordDesc": "Dictate word by word, enter each word independently, suitable for beginners",
    "feature.dictation.sentence": "Sentence Mode",
    "feature.dictation.sentenceDesc": "Listen to the full sentence then enter, train complete sentence comprehension",
    "feature.dictation.feedback": "Instant Feedback",
    "feature.dictation.feedbackDesc": "AI real-time comparison, precisely locate spelling errors",
    "feature.dictation.levels": "Multiple Difficulty Levels",
    "feature.dictation.speed": "Adjustable Playback Speed",
    "feature.dictation.hint": "Hint Function",
    "feature.dictation.try": "Try now",

    "feature.shadowing.title": "Shadowing Practice, Improve Speaking",
    "feature.shadowing.desc": "Shadow the native speaker audio to improve pronunciation, intonation, and speaking speed.",
    "feature.shadowing.record": "Record Your Voice",
    "feature.shadowing.recordDesc": "Record your pronunciation and compare with native speaker audio",
    "feature.shadowing.ai": "AI Pronunciation Analysis",
    "feature.shadowing.aiDesc": "Get instant feedback on pronunciation accuracy and fluency",
    "feature.shadowing.progress": "Track Speaking Progress",
    "feature.shadowing.progressDesc": "Monitor your improvement in pronunciation and fluency over time",
    "feature.shadowing.try": "Try now",

    "feature.ai.title": "AI Intelligent Correction",
    "feature.ai.desc": "Advanced AI technology analyzes your pronunciation and spelling errors, providing precise correction suggestions.",
    "feature.ai.pronunciation": "Pronunciation Analysis",
    "feature.ai.pronunciationDesc": "AI analyzes your pronunciation and provides improvement suggestions",
    "feature.ai.spelling": "Spelling Check",
    "feature.ai.spellingDesc": "Automatically detect spelling errors and provide correct spelling",
    "feature.ai.fluency": "Fluency Assessment",
    "feature.ai.fluencyDesc": "Evaluate speaking fluency and rhythm, help improve naturalness",

    "feature.growth.title": "Growth Tracking, Visible Progress",
    "feature.growth.desc": "Comprehensive statistics help you understand your learning situation and keep motivated.",
    "feature.growth.accuracy": "Accuracy Rate",
    "feature.growth.accuracyDesc": "Track dictation and shadowing accuracy trends",
    "feature.growth.streak": "Learning Streak",
    "feature.growth.streakDesc": "Maintain continuous learning habits and earn achievement badges",
    "feature.growth.history": "Practice History",
    "feature.growth.historyDesc": "Review all practice records and analyze mistakes",

    // FAQ
    "faq.title": "Frequently Asked Questions",
    "faq.subtitle": "Quickly find answers to common questions about this tool",
    "faq.q1.title": "Is ShadowHub free?",
    "faq.q1.answer": "Yes! ShadowHub is completely free to use. No credit card required.",
    "faq.q2.title": "Do I need to create an account?",
    "faq.q2.answer": "You can browse materials without an account, but creating an account allows you to save practice records and track your progress.",
    "faq.q3.title": "What's the difference between Dictation and Shadowing?",
    "faq.q3.answer": "Dictation focuses on listening and writing skills - you hear English and type what you understand. Shadowing focuses on speaking - you repeat after the audio to improve pronunciation.",
    "faq.q4.title": "How does AI scoring work?",
    "faq.q4.answer": "Our AI compares your input with the correct answer, analyzing spelling accuracy, pronunciation quality, and fluency to provide detailed feedback.",

    // CTA
    "cta.title": "Stop 'Not Understanding, Not Speaking Out'",
    "cta.subtitle": "10 minutes of Dictation + Shadowing daily, transform English from an 'exam tool' into a language you can truly use.",
    "cta.button": "Start Learning",
    "cta.contact": "Contact Us",
    "cta.github": "GitHub",

    // Footer
    "footer.about": "About",
    "footer.aboutDesc": "A professional English dictation and shadowing practice tool to help you efficiently improve your listening and speaking skills.",
    "footer.features": "Features",
    "footer.materials": "Materials",
    "footer.resources": "Resources",
    "footer.github": "GitHub",
    "footer.contact": "Contact Us",
    "footer.rights": "All rights reserved.",
  },
  zh: {
    // Navigation
    "nav.topics": "素材",
    "nav.login": "登录",
    "nav.signup": "注册",
    "nav.profile": "个人中心",
    "nav.logout": "退出登录",
    "nav.brand": "语言跟读",

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
    "auth.close": "关闭",

    // How It Works
    "how.title": "如何使用",
    "how.subtitle": "只需 4 个步骤，让英语练习更简单、更有趣",
    "how.step1.title": "选择素材",
    "how.step1.desc": "从我们精心策划的英语音频素材库中选择",
    "how.step2.title": "选择模式",
    "how.step2.desc": "选择听写或跟读练习模式",
    "how.step3.title": "开始练习",
    "how.step3.desc": "按照自己的节奏练习，AI 助手全程陪伴",
    "how.step4.title": "追踪进度",
    "how.step4.desc": "查看统计数据，监控您的进步",

    // Features
    "features.title": "强大的功能，高效的学习",
    "feature.dictation.title": "逐词听写，精准提升",
    "feature.dictation.desc": "通过逐词听写训练加强英语听力理解能力。",
    "feature.dictation.word": "单词模式",
    "feature.dictation.wordDesc": "逐词听写，独立输入每个单词，适合初学者",
    "feature.dictation.sentence": "整句模式",
    "feature.dictation.sentenceDesc": "听完整句后输入，训练完整句子理解",
    "feature.dictation.feedback": "即时反馈",
    "feature.dictation.feedbackDesc": "AI 实时对比，精准定位拼写错误",
    "feature.dictation.levels": "多种难度等级",
    "feature.dictation.speed": "可调节播放速度",
    "feature.dictation.hint": "提示功能",
    "feature.dictation.try": "立即尝试",

    "feature.shadowing.title": "跟读练习，提升口语",
    "feature.shadowing.desc": "跟读原声音频，改善发音、语调和语速。",
    "feature.shadowing.record": "录制声音",
    "feature.shadowing.recordDesc": "录制您的发音并与原声对比",
    "feature.shadowing.ai": "AI 发音分析",
    "feature.shadowing.aiDesc": "获得发音准确度和流利度的即时反馈",
    "feature.shadowing.progress": "追踪口语进步",
    "feature.shadowing.progressDesc": "监控发音和流利度的提升",
    "feature.shadowing.try": "立即尝试",

    "feature.ai.title": "AI 智能纠错",
    "feature.ai.desc": "先进的 AI 技术分析您的发音和拼写错误，提供精准的改进建议。",
    "feature.ai.pronunciation": "发音分析",
    "feature.ai.pronunciationDesc": "AI 分析您的发音并提供改进建议",
    "feature.ai.spelling": "拼写检查",
    "feature.ai.spellingDesc": "自动检测拼写错误并提供正确拼写",
    "feature.ai.fluency": "流利度评估",
    "feature.ai.fluencyDesc": "评估口语流利度和节奏，帮助提升自然度",

    "feature.growth.title": "成长追踪，进步可见",
    "feature.growth.desc": "全面的统计数据帮助您了解学习情况，保持学习动力。",
    "feature.growth.accuracy": "准确率",
    "feature.growth.accuracyDesc": "追踪听写和跟读的准确率趋势",
    "feature.growth.streak": "学习连续记录",
    "feature.growth.streakDesc": "保持连续学习习惯，获得成就徽章",
    "feature.growth.history": "练习历史",
    "feature.growth.historyDesc": "查看所有练习记录，分析错误",

    // FAQ
    "faq.title": "常见问题",
    "faq.subtitle": "快速找到关于此工具的常见问题答案",
    "faq.q1.title": "ShadowHub 是免费的吗？",
    "faq.q1.answer": "是的！ShadowHub 完全免费使用，无需信用卡。",
    "faq.q2.title": "需要创建账号吗？",
    "faq.q2.answer": "不登录也可以浏览素材，但创建账号可以保存练习记录并追踪进度。",
    "faq.q3.title": "听写和跟读有什么区别？",
    "faq.q3.answer": "听写侧重于听力和写作技能 - 您听到英语并输入理解的内容。跟读侧重于口语 - 您跟随音频重复以改善发音。",
    "faq.q4.title": "AI 评分如何工作？",
    "faq.q4.answer": "我们的 AI 将您的输入与正确答案进行比较，分析拼写准确性、发音质量和流利度，提供详细反馈。",

    // CTA
    "cta.title": "告别"听不懂、说不出"",
    "cta.subtitle": "每天 10 分钟听写+跟读，把英语从"考试工具"变成真正能用的语言。",
    "cta.button": "开始学习",
    "cta.contact": "联系我们",
    "cta.github": "GitHub",

    // Footer
    "footer.about": "关于",
    "footer.aboutDesc": "专业的英语听写和跟读练习工具，帮助您高效提升听说能力。",
    "footer.features": "功能",
    "footer.materials": "素材",
    "footer.resources": "资源",
    "footer.github": "GitHub",
    "footer.contact": "联系我们",
    "footer.rights": "版权所有。",
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
