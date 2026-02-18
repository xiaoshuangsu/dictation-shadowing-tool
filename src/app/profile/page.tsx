/**
 * Profile Page - V3 Data Retention System
 *
 * Displays user statistics with left-right split layout:
 * - Left: User info, streak stats, cumulative stats, today's progress
 * - Right: Practice history
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { getUserStats, getRecentPracticeRecords } from '@/lib/supabase/client'
import { getUserCompleteProfile } from '@/lib/supabase/streak'
import { supabase } from '@/lib/supabase/client'
import AuthButton from '@/components/auth/AuthButton'
import PracticeHistory from '@/components/profile/PracticeHistory'
import UnlockedPrompt from '@/components/profile/UnlockedPrompt'
import type { PracticeRecord } from '@/components/profile/PracticeHistory'

export default function ProfilePage() {
  const { user, loading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedStatsTab, setSelectedStatsTab] = useState<'dictation' | 'shadowing'>('dictation')

  // V3 统计数据
  const [streakData, setStreakData] = useState({
    current_streak: 0,
    max_streak: 0,
    last_completed_date: null as string | null,
  })
  const [cumulativeStats, setCumulativeStats] = useState({
    total_dictation_sentences: 0,
    total_dictation_minutes: 0,
    total_shadowing_minutes: 0,
    total_shadowing_sessions: 0,
  })
  const [todayRecord, setTodayRecord] = useState({
    dictation_count: 0,
    shadowing_minutes: 0,
    completed: false,
  })

  // 历史记录
  const [recentRecords, setRecentRecords] = useState<PracticeRecord[]>([])

  // Fetch user statistics
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserData()
    } else if (!loading && !isAuthenticated) {
      setStatsLoading(false)
    }
  }, [isAuthenticated, user, loading])

  const fetchUserData = async () => {
    if (!user) return

    setStatsLoading(true)
    try {
      // V3 数据：获取完整档案（连胜 + 累计统计 + 今日记录）
      const completeProfile = await getUserCompleteProfile(user.id)

      if (completeProfile.streak) {
        setStreakData({
          current_streak: completeProfile.streak.current_streak || 0,
          max_streak: completeProfile.streak.max_streak || 0,
          last_completed_date: completeProfile.streak.last_completed_date,
        })
      }

      if (completeProfile.stats) {
        setCumulativeStats({
          total_dictation_sentences: completeProfile.stats.total_dictation_sentences || 0,
          total_dictation_minutes: completeProfile.stats.total_dictation_minutes || 0,
          total_shadowing_minutes: completeProfile.stats.total_shadowing_minutes || 0,
          total_shadowing_sessions: completeProfile.stats.total_shadowing_sessions || 0,
        })
      }

      // 从 practice_records 计算今日的 Shadowing 时间
      const today = new Date().toISOString().split('T')[0]
      const { data: todayShadowingData } = await supabase
        .from('practice_records')
        .select('duration_seconds')
        .eq('user_id', user.id)
        .eq('practice_mode', 'shadowing')
        .gte('completed_at', today)

      const todayShadowingSeconds = (todayShadowingData || [])
        .reduce((sum, record) => sum + (record.duration_seconds || 0), 0)
      const todayShadowingMinutes = Math.ceil(todayShadowingSeconds / 60)

      console.log('fetchUserData - Today shadowing time:', {
        todayShadowingSeconds,
        todayShadowingMinutes,
        recordCount: todayShadowingData?.length || 0
      })

      if (completeProfile.todayRecord) {
        setTodayRecord({
          dictation_count: completeProfile.todayRecord.dictation_count || 0,
          shadowing_minutes: todayShadowingMinutes, // 使用计算出的真实时间
          completed: completeProfile.todayRecord.completed || false,
        })
      }

      // 获取历史记录
      const records = await getRecentPracticeRecords(user.id, 10)
      const transformedRecords = records.map((r) => ({
        id: r.id,
        sentenceText: r.sentence_text,
        practiceMode: r.practice_mode,
        dictationMode: r.dictation_mode || undefined,
        isCorrect: r.is_correct,
        usedShowWords: r.used_show_words,
        completedAt: new Date(r.completed_at),
      }))
      setRecentRecords(transformedRecords)
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  // Show unlocked prompt for non-authenticated users
  if (!isAuthenticated) {
    return <UnlockedPrompt />
  }

  const totalPractices = cumulativeStats.total_dictation_sentences + cumulativeStats.total_shadowing_sessions

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <button
            onClick={() => router.push('/')}
            className="text-xl font-bold text-gray-800 hover:text-gray-600"
          >
            ← 返回
          </button>
          <AuthButton />
        </div>
      </nav>

      {/* Main Content - Left-Right Split Layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">个人中心</h1>
          <p className="text-gray-600 mt-1">
            欢迎回来，{user?.username || '用户'}！
          </p>
        </div>

        {/* Loading State */}
        {statsLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载统计数据中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - User Profile & Core Stats (1/3 width) */}
            <div className="lg:col-span-1 space-y-6">
              {/* User Info Card */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{user?.username || '用户'}</h2>
                    <p className="text-sm text-gray-600">{user?.email || ''}</p>
                  </div>
                </div>
              </div>

              {/* Streak Stats Card */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow-sm p-6 border border-orange-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  连胜记录
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">当前连胜</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {streakData.current_streak} 天
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">历史最高</span>
                    <span className="text-2xl font-bold text-red-600">
                      {streakData.max_streak} 天
                    </span>
                  </div>
                </div>
              </div>

              {/* Cumulative Stats - Tabbed Layout */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                {/* Tab Headers */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setSelectedStatsTab('dictation')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      selectedStatsTab === 'dictation'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    听写练习
                  </button>
                  <button
                    onClick={() => setSelectedStatsTab('shadowing')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      selectedStatsTab === 'shadowing'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    影子跟读
                  </button>
                </div>

                {/* Tab Content */}
                {selectedStatsTab === 'dictation' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600 mb-1">
                        {cumulativeStats.total_dictation_sentences}
                      </p>
                      <p className="text-sm text-gray-600">总句数</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600 mb-1">
                        {cumulativeStats.total_dictation_minutes}
                      </p>
                      <p className="text-sm text-gray-600">总时间（分钟）</p>
                    </div>
                  </div>
                )}

                {selectedStatsTab === 'shadowing' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600 mb-1">
                        {cumulativeStats.total_shadowing_sessions}
                      </p>
                      <p className="text-sm text-gray-600">总句数</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600 mb-1">
                        {cumulativeStats.total_shadowing_minutes}
                      </p>
                      <p className="text-sm text-gray-600">总时间（分钟）</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Today's Progress Card */}
              <div
                className={`rounded-lg shadow-sm p-6 border-2 ${
                  todayRecord.completed ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  今日进度 {todayRecord.completed && '✅'}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">听写句子</span>
                    <span
                      className={`font-semibold ${
                        todayRecord.dictation_count >= 3 ? 'text-green-600' : 'text-gray-900'
                      }`}
                    >
                      {todayRecord.dictation_count} / 3
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((todayRecord.dictation_count / 3) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Shadowing 分钟</span>
                    <span
                      className={`font-semibold ${
                        todayRecord.shadowing_minutes >= 5 ? 'text-green-600' : 'text-gray-900'
                      }`}
                    >
                      {todayRecord.shadowing_minutes} / 5
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((todayRecord.shadowing_minutes / 5) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Practice History (2/3 width) */}
            <div className="lg:col-span-2">
              <PracticeHistory records={recentRecords} />

              {/* Empty State */}
              {totalPractices === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">开始您的第一次练习</h3>
                  <p className="text-gray-600 mb-4">完成后，您的统计数据将显示在这里</p>
                  <button
                    onClick={() => router.push('/')}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    开始练习
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
