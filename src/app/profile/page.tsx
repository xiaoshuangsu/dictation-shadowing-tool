/**
 * Profile Page
 *
 * Displays user statistics and practice history.
 * Shows different content based on authentication state.
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { getUserStats, getRecentPracticeRecords } from '@/lib/supabase/client'
import AuthButton from '@/components/auth/AuthButton'
import StatsCards from '@/components/profile/StatsCards'
import PracticeHistory from '@/components/profile/PracticeHistory'
import UnlockedPrompt from '@/components/profile/UnlockedPrompt'
import type { PracticeRecord } from '@/components/profile/PracticeHistory'

export default function ProfilePage() {
  const { user, loading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [statsLoading, setStatsLoading] = useState(true)
  const [totalPractices, setTotalPractices] = useState(0)
  const [averageAccuracy, setAverageAccuracy] = useState(0)
  const [todayPractices, setTodayPractices] = useState(0)
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
      // Fetch stats from Supabase
      const stats = await getUserStats(user.id)

      setTotalPractices(stats.totalPractices)
      setTodayPractices(stats.todayPractices)
      setAverageAccuracy(stats.averageAccuracy)

      // Fetch recent records
      const records = await getRecentPracticeRecords(user.id, 10)

      // Transform records to match the component's expected format
      const transformedRecords = records.map(r => ({
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
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
          <>
            {/* Stats Cards */}
            <StatsCards
              totalPractices={totalPractices}
              averageAccuracy={averageAccuracy}
              todayPractices={todayPractices}
            />

            {/* Practice History */}
            <PracticeHistory records={recentRecords} />

            {/* Empty State */}
            {totalPractices === 0 && (
              <div className="mt-6 bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  开始您的第一次练习
                </h3>
                <p className="text-gray-600 mb-4">
                  完成练习后，您的统计数据将显示在这里
                </p>
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
          </>
        )}
      </div>
    </div>
  )
}
