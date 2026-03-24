/**
 * Profile Page - V3 Data Retention System
 *
 * Displays user statistics with left-right split layout:
 * - Left: User info, streak stats, cumulative stats, today's progress
 * - Right: Practice history
 *
 * 优化：
 * - 数据缓存机制（60秒）
 * - 静默更新（有缓存时先展示旧数据）
 * - 禁用不必要的重新获取
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { getUserStats } from '@/lib/supabase/client'
import { getMaterialProgressFallback, type MaterialProgress } from '@/lib/supabase/client'
import { getUserCompleteProfile } from '@/lib/supabase/streak'
import { supabase } from '@/lib/supabase/client'
import AuthButton from '@/components/auth/AuthButton'
import MaterialProgressList from '@/components/profile/MaterialProgress'
import UnlockedPrompt from '@/components/profile/UnlockedPrompt'


export function ProfilePageContent() {
  const { user, loading, isAuthenticated } = useAuth()
  const router = useRouter()
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedStatsTab, setSelectedStatsTab] = useState<'dictation' | 'shadowing'>('dictation')

  // 🔴 数据缓存时间戳（5分钟）
  const CACHE_DURATION = 300000  // 5分钟
  const lastFetchTimeRef = useRef<number>(0)
  const cacheDataRef = useRef<any>(null)

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

  // 素材进度数据
  const [materialProgress, setMaterialProgress] = useState<MaterialProgress[]>([])
  const [progressLoading, setProgressLoading] = useState(true)

  // 🔴 分离的素材进度缓存时间戳（5分钟）
  const PROGRESS_CACHE_DURATION = 300000  // 5分钟
  const lastProgressFetchTimeRef = useRef<number>(0)
  const progressCacheDataRef = useRef<{ [key: string]: MaterialProgress[], timestamp: number } | null>(null)

  // 🔴 检查统计数据缓存是否有效
  const isStatsCacheValid = () => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTimeRef.current
    return timeSinceLastFetch < CACHE_DURATION
  }

  // 🔴 检查素材进度缓存是否有效
  const isProgressCacheValid = (mode: 'dictation' | 'shadowing') => {
    const cache = progressCacheDataRef.current
    if (!cache || !cache[mode]) return false

    const now = Date.now()
    const timeSinceLastFetch = now - cache.timestamp
    return timeSinceLastFetch < PROGRESS_CACHE_DURATION
  }

  // 当切换练习模式Tab时，重新加载素材进度
  useEffect(() => {
    // 🔴 禁用窗口聚焦自动加载：只在缓存失效时才重新获取
    const cacheValid = isProgressCacheValid(selectedStatsTab)
    const hasCachedData = materialProgress.length > 0

    if (isAuthenticated && user && !cacheValid) {
      console.log(`🔧 [Profile] 素材进度缓存失效，重新获取 (${selectedStatsTab})`)
      fetchMaterialProgress(selectedStatsTab)
    } else if (cacheValid && hasCachedData) {
      // 🔴 静默刷新：使用缓存数据，后台更新
      console.log(`🔄 [Profile] 使用素材进度缓存（${selectedStatsTab}），静默更新中...`)
      fetchMaterialProgress(selectedStatsTab)
    }
    // 🔴 关键：移除 user 依赖，防止用户对象引用变化导致重新获取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatsTab, isAuthenticated])

  // Fetch user statistics
  useEffect(() => {
    // 🔴 优化：检查缓存，避免频繁重新获取
    if (isAuthenticated && user) {
      if (isStatsCacheValid() && cacheDataRef.current) {
        // 🔴 静默更新：使用缓存数据
        console.log('🔄 [Profile] 使用缓存统计数据，静默更新中...')
        fetchUserData()  // 后台更新数据
      } else {
        // 首次加载或缓存失效，显示 loading
        console.log('🔧 [Profile] 缓存失效，重新获取数据')
        fetchUserData()
      }
    } else if (!loading && !isAuthenticated) {
      setStatsLoading(false)
    }
    // 🔴 关键：移除 user 依赖，防止用户对象引用变化导致重新获取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loading])

  // 🔴 页面初始化位置：确保滚动到最顶部
  useEffect(() => {
    // 禁止任何自动滚动
    window.scrollTo({ top: 0, behavior: 'auto' })
    console.log('🔧 [Profile] 页面初始化：强制滚动到顶部')
  }, []) // 只在组件挂载时执行一次

  const fetchUserData = async () => {
    if (!user) return

    // 🔴 静默更新：如果已经有数据，后台更新
    const hasCachedData = cacheDataRef.current !== null
    if (hasCachedData) {
      console.log('🔄 [Profile] 静默更新：保持界面显示，后台获取新数据')
    } else {
      setStatsLoading(true)
    }

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
        .reduce((sum: number, record: any) => sum + (record.duration_seconds || 0), 0)
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

      // 🔴 更新缓存
      cacheDataRef.current = {
        streakData,
        cumulativeStats,
        todayRecord
      }
      lastFetchTimeRef.current = Date.now()
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchMaterialProgress = async (mode: 'dictation' | 'shadowing') => {
    if (!user) return

    // 🔴 静默刷新：检查是否有缓存数据
    const hasCachedData = progressCacheDataRef.current !== null &&
                         progressCacheDataRef.current[mode] !== undefined
    const cacheKey = mode

    if (hasCachedData) {
      console.log(`🔄 [Profile] 静默更新素材进度 (${mode})，保持当前显示`)
      // 不设置 loading，保持当前显示
    } else {
      console.log(`🔧 [Profile] 首次加载素材进度 (${mode})，显示 loading`)
      setProgressLoading(true)
    }

    try {
      const progress = await getMaterialProgressFallback(user.id, mode)
      setMaterialProgress(progress)

      // 🔴 更新缓存
      progressCacheDataRef.current = {
        ...(progressCacheDataRef.current || {}),
        [mode]: progress,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Failed to fetch material progress:', error)
      setMaterialProgress([])
    } finally {
      setProgressLoading(false)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
      {/* Main Content - Left-Right Split Layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.username || 'User'}!
          </p>
        </div>

        {/* Loading State */}
        {statsLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading statistics...</p>
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
                    <h2 className="text-xl font-bold text-gray-900">{user?.username || 'User'}</h2>
                    <p className="text-sm text-gray-600">{user?.email || ''}</p>
                  </div>
                </div>
              </div>

              {/* Streak Stats Card */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow-sm p-6 border border-orange-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  Streak
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Current Streak</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {streakData.current_streak} days
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Best Streak</span>
                    <span className="text-2xl font-bold text-red-600">
                      {streakData.max_streak} days
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
                    Dictation
                  </button>
                  <button
                    onClick={() => setSelectedStatsTab('shadowing')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      selectedStatsTab === 'shadowing'
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Shadowing
                  </button>
                </div>

                {/* Tab Content */}
                {selectedStatsTab === 'dictation' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600 mb-1">
                        {cumulativeStats.total_dictation_sentences}
                      </p>
                      <p className="text-sm text-gray-600">Total Sentences</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600 mb-1">
                        {cumulativeStats.total_dictation_minutes}
                      </p>
                      <p className="text-sm text-gray-600">Total Minutes</p>
                    </div>
                  </div>
                )}

                {selectedStatsTab === 'shadowing' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600 mb-1">
                        {cumulativeStats.total_shadowing_sessions}
                      </p>
                      <p className="text-sm text-gray-600">Total Sentences</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600 mb-1">
                        {cumulativeStats.total_shadowing_minutes}
                      </p>
                      <p className="text-sm text-gray-600">Total Minutes</p>
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
                  Today's Progress {todayRecord.completed && '✅'}
                </h3>

                {/* 单一进度条 */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        todayRecord.completed ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(todayRecord.completed ? 100 : Math.max(
                        (todayRecord.dictation_count / 10) * 100,
                        (todayRecord.shadowing_minutes / 10) * 100
                      ), 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* 百分比显示 */}
                <div className="text-center">
                  <span className={`text-3xl font-bold ${
                    todayRecord.completed ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {todayRecord.completed ? '100' : Math.round(Math.max(
                      (todayRecord.dictation_count / 10) * 100,
                      (todayRecord.shadowing_minutes / 10) * 100
                    ))}%
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Practice History (2/3 width) */}
            <div className="lg:col-span-2">
              {/* 素材进度列表 */}
              {progressLoading ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading practice records...</p>
                </div>
              ) : (
                <MaterialProgressList materials={materialProgress} practiceMode={selectedStatsTab} />
              )}

              {/* Empty State */}
              {!progressLoading && materialProgress.length === 0 && (
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Start your first practice</h3>
                  <p className="text-gray-600 mb-4">Your statistics will appear here after completion</p>
                  <button
                    onClick={() => router.push('/topics')}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Start Practice
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
