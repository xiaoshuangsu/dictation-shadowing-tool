/**
 * Vocabulary Hub Content - 学习中心看板内容
 *
 * V1.4 - 响应式左右结构（桌面端 flex-row，移动端 flex-col）
 * - 左侧 60%：行动焦点
 * - 右侧 40%：数据反馈
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import Link from 'next/link'
import { Flame, TrendingUp, Target, Award, BookOpen, Clock, Star } from 'lucide-react'

// Mock 数据：今日复习统计
interface TodayStats {
  dueWords: number
  reviewed: number
  accuracy: number
  streak: number
}

// Mock 数据：词库列表
interface WordList {
  id: string
  title: string
  description: string
  icon: any
  color: string
  count: number
  progress: number
  category: string
}

const WORD_LISTS: WordList[] = [
  {
    id: 'my-words',
    title: 'My Words',
    description: 'Your personal vocabulary collection',
    icon: BookOpen,
    color: 'from-blue-500 to-blue-600',
    count: 0,
    progress: 0,
    category: 'my-words'
  },
  {
    id: 'oxford-3000',
    title: 'Oxford 3000',
    description: 'Essential English words for learners',
    icon: Target,
    color: 'from-green-500 to-green-600',
    count: 3000,
    progress: 12,
    category: 'oxford-3000'
  },
  {
    id: 'ielts',
    title: 'IELTS Vocabulary',
    description: 'Academic words for IELTS preparation',
    icon: Award,
    color: 'from-purple-500 to-purple-600',
    count: 4141,
    progress: 8,
    category: 'ielts'
  },
  {
    id: 'daily-conversation',
    title: 'Daily Conversation',
    description: 'Common words for daily life',
    icon: Clock,
    color: 'from-orange-500 to-orange-600',
    count: 0,
    progress: 0,
    category: 'daily-conversation'
  },
  {
    id: 'business-english',
    title: 'Business English',
    description: 'Professional vocabulary for work',
    icon: TrendingUp,
    color: 'from-indigo-500 to-indigo-600',
    count: 0,
    progress: 0,
    category: 'business-english'
  }
]

export function VocabularyHubContent() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<TodayStats>({
    dueWords: 0,
    reviewed: 0,
    accuracy: 0,
    streak: 0
  })
  const [myWordsCount, setMyWordsCount] = useState(0)

  // 加载用户数据
  useEffect(() => {
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      // Mock 统计数据
      setStats({
        dueWords: 15,
        reviewed: 8,
        accuracy: 85,
        streak: 7
      })

      setMyWordsCount(42)
    }

    loadData()
  }, [])

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // 未登录
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Vocabulary Learning Hub</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Please Sign In</h2>
            <p className="text-gray-600 mb-6">Sign in to access your personalized vocabulary learning center</p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 更新 My Words 的数量
  const wordListsWithCount = WORD_LISTS.map(list => {
    if (list.id === 'my-words') {
      return { ...list, count: myWordsCount }
    }
    return list
  })

  // 计算进度百分比
  const progressPercent = stats.dueWords > 0 ? Math.round((stats.reviewed / stats.dueWords) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vocabulary Learning Hub</h1>
              <p className="text-gray-600 mt-1">Your personalized vocabulary learning center</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ============================================================ */}
        {/* 🎯 响应式左右结构 Hero */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-100 border-b-4 border-slate-100 rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* ============================================================ */}
            {/* 左侧：行动焦点区域 (60%) */}
            {/* ============================================================ */}
            <div className="flex-1 px-6 py-8 md:py-10">
              <div className="flex flex-col items-center md:items-start text-center md:text-left h-full justify-center">
                {/* 标题 */}
                <div className="flex items-center gap-2.5 mb-5">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h2 className="text-xl font-bold text-gray-900">Today's Review</h2>
                </div>

                {/* 核心视觉焦点：大数字 */}
                <div className="mb-6">
                  <div className="text-5xl md:text-6xl font-bold text-gray-900 mb-2">
                    {stats.dueWords}
                  </div>
                  <p className="text-gray-500 text-sm md:text-base">Words to Review Today</p>
                </div>

                {/* 醒目 CTA 按钮 */}
                {stats.dueWords > 0 && (
                  <Link
                    href="/vocabulary/my-words"
                    className="inline-flex items-center gap-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white px-7 py-3.5 rounded-xl text-base font-semibold hover:scale-105 hover:shadow-lg hover:shadow-orange-200 transition-all duration-200"
                  >
                    <Star className="w-4 h-4" />
                    Start Reviewing
                  </Link>
                )}
              </div>
            </div>

            {/* ============================================================ */}
            {/* 垂直分隔线（仅桌面端） */}
            {/* ============================================================ */}
            <div className="hidden md:block w-px bg-slate-100"></div>

            {/* ============================================================ */}
            {/* 右侧：数据反馈区域 (40%) */}
            {/* ============================================================ */}
            <div className="flex-1 px-6 py-8 md:py-10">
              <div className="h-full flex flex-col justify-center">
                {/* 进度条 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Progress</span>
                    <span className="text-sm font-mono font-semibold text-gray-900">
                      {stats.reviewed} / {stats.dueWords}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <div className="mt-1.5 text-right">
                    <span className="text-xs font-semibold text-green-600">{progressPercent}%</span>
                  </div>
                </div>

                {/* 2x2 指标网格 */}
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {/* Due Today */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">Due Today</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.dueWords}</div>
                  </div>

                  {/* Reviewed */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">Reviewed</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.reviewed}</div>
                  </div>

                  {/* Accuracy */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">Accuracy</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.accuracy}%</div>
                  </div>

                  {/* Streak */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">Streak</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{stats.streak}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 📚 Word Libraries - 词库入口卡片 */}
        {/* ============================================================ */}
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Word Libraries</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wordListsWithCount.map((list) => {
              const Icon = list.icon
              return (
                <Link
                  key={list.id}
                  href={`/vocabulary/${list.category}`}
                  className="bg-white border border-slate-100 rounded-lg p-5 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`bg-gradient-to-br ${list.color} p-2 rounded-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {list.count > 0 && (
                      <span className="text-xs text-gray-500">{list.count} words</span>
                    )}
                  </div>

                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {list.title}
                  </h3>

                  <p className="text-gray-500 text-xs md:text-sm mb-3">{list.description}</p>

                  {list.progress > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{list.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${list.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {list.count === 0 && (
                    <div className="text-xs text-gray-400 italic">Coming soon</div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
