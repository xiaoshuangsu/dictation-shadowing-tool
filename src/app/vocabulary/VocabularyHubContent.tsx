/**
 * Vocabulary Hub Content - 学习中心看板内容
 *
 * V1.6 - Streak 目标与火焰动画
 * - 左侧 60%：行动焦点
 * - 右侧 40%：数据反馈
 * - 数据自动刷新：复习后统计数据自动更新
 * - 🔥 火焰动画：达成每日目标（20个单词）后触发
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import Link from 'next/link'
import { Flame, TrendingUp, Target, Award, BookOpen, Clock, Star } from 'lucide-react'
import ReviewOverlay from '@/components/ReviewOverlay'

// 真实统计数据：今日复习统计
interface TodayStats {
  dueWords: number
  reviewed: number
  newWords?: number  // 🔥 V3.0: 今日新学单词数
  accuracy: number
  streak: number
  goalAchieved: boolean  // 🔥 是否达成每日目标
  dailyGoal: number     // 每日目标（20个单词）
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

// SWR fetcher 函数
const fetcher = async (url: string, userId: string) => {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${userId}` }
  })
  if (!response.ok) throw new Error('Failed to fetch stats')
  return response.json()
}

export function VocabularyHubContent() {
  const { user, loading: authLoading } = useAuth()
  const [myWordsCount, setMyWordsCount] = useState(0)
  const [showReviewOverlay, setShowReviewOverlay] = useState(false)
  const [dueWordsQueue, setDueWordsQueue] = useState<any[]>([])

  // 🔥 V3.0: 乐观更新状态（本地实时计数）
  const [localReviewedIncrement, setLocalReviewedIncrement] = useState(0)
  const [localDueWordsIncrement, setLocalDueWordsIncrement] = useState(0)  // 🔥 V4.5: Today's Review 本地增量
  const [isRefreshing, setIsRefreshing] = useState(false)  // 加载状态

  // 🔥 V4.5: 使用 ref 来访问最新的状态值（在回调中）
  const localReviewedIncrementRef = useRef(localReviewedIncrement)
  const localDueWordsIncrementRef = useRef(localDueWordsIncrement)

  // 🔥 V4.5: 同步 ref 的值
  useEffect(() => {
    localReviewedIncrementRef.current = localReviewedIncrement
    localDueWordsIncrementRef.current = localDueWordsIncrement
  })

  // 🔥 V3.1: 加载状态与错误提示
  const [isFetchingWords, setIsFetchingWords] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 🔥 V3.3: 记录初始 Today's Review 数量（用于区分复习模式和主动练习）
  const [initialDueWordsCount, setInitialDueWordsCount] = useState(0)

  // 🔥 使用 SWR 获取统计数据（自动缓存和重新验证）
  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    user ? ['/api/user-words/stats', user.id] : null,
    ([url, userId]) => fetcher(url, userId as string),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10000, // 10秒内相同请求自动去重
      refreshInterval: 0 // 手动刷新
    }
  )

  // 解析统计数据
  const baseStats: TodayStats = statsData?.stats || {
    dueWords: 0,
    reviewed: 0,
    newWords: 0,
    accuracy: 0,
    streak: 0,
    goalAchieved: false,
    dailyGoal: 20
  }

  // 🔥 V3.0: 合并服务器数据和本地乐观更新
  const stats: TodayStats = {
    ...baseStats,
    dueWords: baseStats.dueWords + localDueWordsIncrement,  // 🔥 V4.5: 合并 Today's Review 增量
    reviewed: baseStats.reviewed + localReviewedIncrement
  }

  // 加载用户数据
  useEffect(() => {
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      setMyWordsCount(42) // Mock 数据，后续可从 API 获取
    }

    if (user) {
      loadData()
    }
  }, [user])

  // 获取今日到期的单词
  const fetchDueWords = async () => {
    if (!user) {
      return
    }

    // 🔥 V3.1: 重置状态
    setIsFetchingWords(true)
    setFetchError(null)

    // 🔥 V3.1: 使用标志位跟踪数据是否成功返回
    let dataReceived = false

    // 🔥 V3.1: 8秒超时保护（只在数据确实没有返回时触发）
    const timeoutId = setTimeout(() => {
      if (!dataReceived && isFetchingWords) {
        setIsFetchingWords(false)
        setShowReviewOverlay(false)
        setFetchError('获取单词列表超时，请重试')
        alert('⏰ 请求超时\n\n获取单词列表超过 8 秒，请稍后重试。\n\n如果问题持续存在，可能是网络连接或服务器问题。')
      }
    }, 8000)

    try {
      const response = await fetch('/api/user-words?status=learning&limit=100', {
        headers: { 'Authorization': `Bearer ${user.id}` }
      })

      if (response.ok) {
        const data = await response.json()

        // 🔥 V3.1: 立即标记数据已收到，防止超时逻辑误伤
        dataReceived = true

        const now = new Date()

        // 过滤出今日到期的单词
        const dueWords = data.words?.filter((w: any) => {
          if (!w.next_review_at) return true
          return new Date(w.next_review_at) <= now
        }) || []

        // 🔥 V3.1: 立即清除超时定时器
        clearTimeout(timeoutId)

        if (dueWords.length > 0) {
          // 🔥 V3.1: 先设置单词队列
          setDueWordsQueue(dueWords)

          // 🔥 V3.3: 记录初始 Today's Review 数量
          setInitialDueWordsCount(stats.dueWords)

          // 🔥 V3.1: 立即关闭 Loading，不等待弹窗渲染
          setIsFetchingWords(false)

          // 🔥 V3.1: 立即打开弹窗（不需要 setTimeout）
          setShowReviewOverlay(true)
        } else {
          setIsFetchingWords(false)
          alert('✅ 所有单词都已复习完成！\n\n今日没有需要复习的单词。')
        }
      } else {
        const errorText = await response.text()
        setIsFetchingWords(false)
        clearTimeout(timeoutId)
        setFetchError(`API 请求失败: ${response.status}`)
        alert(`❌ 获取单词失败\n\n状态码: ${response.status}\n\n请稍后重试，如果问题持续，请联系技术支持。`)
      }
    } catch (error) {
      setIsFetchingWords(false)
      clearTimeout(timeoutId)
      setFetchError(`网络错误: ${(error as Error).message}`)
      alert(`❌ 网络错误\n\n${(error as Error).message}\n\n请检查网络连接后重试。`)
    }
  }

  const handleStartReviewing = () => {
    fetchDueWords()
  }

  const handleCloseReview = () => {
    setShowReviewOverlay(false)
    setDueWordsQueue([])
    setIsRefreshing(true)  // 显示加载状态

    // 🔥 V4.5: 延迟刷新统计数据，重置本地计数器

    setTimeout(async () => {
      try {
        // 强制 SWR 重新从服务器拉取
        await mutateStats(
          undefined,
          {
            revalidate: true,
            deduping: false,
            optimisticData: undefined
          }
        )

        // 🔥 V4.5: 重置所有本地计数器
        setLocalDueWordsIncrement(0)
        setLocalReviewedIncrement(0)
      } catch (error) {
        // 即使失败也重置计数器
        setLocalDueWordsIncrement(0)
        setLocalReviewedIncrement(0)
      } finally {
        setIsRefreshing(false)
      }
    }, 1500)
  }

  // 🔥 V4.5: 乐观更新回调（接收精确的计数更新）
  const handleReviewComplete = (update: { dueWordsChange: number, reviewedChange: number }) => {
    const { dueWordsChange, reviewedChange } = update

    // 🔥 V4.5: 根据更新值调整本地计数
    if (dueWordsChange !== 0) {
      setLocalDueWordsIncrement(prev => prev + dueWordsChange)
    }
    if (reviewedChange !== 0) {
      setLocalReviewedIncrement(prev => prev + reviewedChange)
    }
  }

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

  // 计算进度百分比（基于每日目标，防止超过 100%）
  // 🔥 V3.0: 使用每日目标作为分母，确保进度不会超过 100%
  const progressPercent = Math.min(
    100,
    stats.dailyGoal > 0 ? Math.round((stats.reviewed / stats.dailyGoal) * 100) : 0
  )

  // 🔥 火焰状态：根据每日目标达成状态切换动画
  const isFireActive = stats.goalAchieved || false

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
                  <h2 className="text-xl font-bold text-gray-900">Today&apos;s Review</h2>
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
                  <button
                    onClick={handleStartReviewing}
                    disabled={isFetchingWords}
                    className={`inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-semibold transition-all duration-200 ${
                      isFetchingWords
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:scale-105 hover:shadow-lg hover:shadow-orange-200'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                    {isFetchingWords ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Loading...
                      </>
                    ) : (
                      'Start Reviewing'
                    )}
                  </button>
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
                    <span className="text-sm font-medium text-gray-600">
                      Progress
                      {isRefreshing && (
                        <span className="ml-2 text-xs text-blue-500 animate-pulse">Syncing...</span>
                      )}
                    </span>
                    <span className={`text-sm font-mono font-semibold ${isRefreshing ? 'text-blue-600 animate-pulse' : 'text-gray-900'}`}>
                      {stats.reviewed} / {stats.dailyGoal}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r h-2.5 rounded-full transition-all duration-500 ease-out ${
                        isRefreshing ? 'from-blue-500 to-cyan-500 animate-pulse' : 'from-green-500 to-emerald-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <div className="mt-1.5 text-right">
                    <span className={`text-xs font-semibold ${isRefreshing ? 'text-blue-600' : 'text-green-600'}`}>
                      {progressPercent}%
                    </span>
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
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Flame
                          className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${
                            isFireActive
                              ? 'text-orange-500 animate-fire-pulse'
                              : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs text-gray-500">Streak</span>
                      </div>
                      {/* 🔥 每日目标提示 */}
                      {isFireActive && (
                        <span className="text-[10px] font-bold text-orange-600 animate-pulse">
                          🔥
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-xl font-bold text-gray-900">{stats.streak}</div>
                      <div className="text-[10px] text-gray-400">
                        / {stats.dailyGoal}
                      </div>
                    </div>
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

      {/* 🔥 连续复习弹窗 - 首页直接复习 */}
      {showReviewOverlay && dueWordsQueue.length > 0 && user && (
        <ReviewOverlay
          key={`flashcard-hub-${dueWordsQueue[0]?.word || 'initial'}`}
          initialDueWordsCount={initialDueWordsCount}
          words={dueWordsQueue.map((w: any) => {
            // 🔥 V3.1: 容错处理 - 确保所有必需字段都有默认值
            const wordData = {
              id: w.id || '',
              word: w.word || 'unknown',
              phonetic: w.phonetic || '',
              definition: w.definition || null, // 🔥 允许 null
              translations: w.translations || null,
              context_sentence: w.context_sentence || w.dictionary_cache?.example || '',
              audio_url_us: w.audio_url_us || w.dictionary_cache?.audio_url_us || '',
              audio_url_uk: w.audio_url_uk || w.dictionary_cache?.audio_url_uk || '',
              dictionary_cache: w.dictionary_cache || null,
              material_info: w.material_info || null,
              audio_timestamp: w.audio_timestamp || null,
              material_title: w.material_title || '',
              next_review_at: w.next_review_at || null  // 🔥 V3.3: 传递 next_review_at，用于判断复习模式
            }

            return wordData
          })}
          user={user}
          onClose={handleCloseReview}
          onReviewComplete={handleReviewComplete}
        />
      )}
    </div>
  )
}
