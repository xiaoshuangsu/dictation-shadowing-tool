/**
 * User Words Stats API
 * 获取用户生词统计信息
 *
 * V3.0 - 修正统计逻辑，区分新学与复习
 * - Due Today: 统计 next_review_at <= now 的单词（仅 learning 状态）
 * - Reviewed Today: 统计今天复习过的单词（updated_at 在今天且 created_at 在今天之前）
 * - New Words Today: 统计今天新添加的单词（created_at 在今天）
 * - Accuracy: 根据掌握状态计算准确率
 * - Streak: 从 user_profiles 获取连胜天数
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 强制动态路由（Vercel 部署要求）
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    // 获取用户 ID（从 Authorization header）
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authHeader.replace('Bearer ', '')

    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取用户的所有生词（只选择必要字段，减少流量）
    const { data: userWords, error } = await supabase
      .from('user_words')
      .select('mastery_status, next_review_at, updated_at, created_at')
      .eq('user_id', userId)

    if (error) {
      console.error('[Stats API] ❌ 获取用户生词失败:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 })
    }

    // 计算统计数据
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 1. Due Today: 统计 next_review_at <= now 的单词（仅 learning 状态）
    // 🔥 V3.0 彻底掌握模式：删除日期过滤，只要是 learning 且到期就计入
    const dueWords = userWords?.filter((w: any) => {
      // 必须是 learning 状态
      if (w.mastery_status !== 'learning') return false

      // 检查是否到期（不管今天是否复习过）
      if (!w.next_review_at) return true
      return new Date(w.next_review_at) <= now
    }).length || 0

    // 2. Reviewed Today: 统计今天复习过的单词
    // 🔥 V3.0 修复：包含所有今天复习过的单词
    // - 以前添加的单词，今天复习过
    // - 今天添加后又复习的单词（updated_at > created_at）
    const reviewedWords = userWords?.filter((w: any) => {
      const updatedAt = new Date(w.updated_at)
      const createdAt = new Date(w.created_at)

      // 情况1：今天更新过，且不是今天创建的 → 复习过
      if (updatedAt >= todayStart && createdAt < todayStart) {
        return true
      }

      // 情况2：今天创建的，但更新时间晚于创建时间 → 创建后又复习过
      if (createdAt >= todayStart && updatedAt > createdAt) {
        return true
      }

      return false
    }) || []

    const reviewedToday = reviewedWords.length

    // 3. New Words Today: 统计今天新添加的单词
    const newWordsToday = userWords?.filter((w: any) => {
      const createdAt = new Date(w.created_at)
      return createdAt >= todayStart
    }).length || 0

    // 3. Accuracy: 根据掌握状态计算准确率
    // mastered = 100% 正确, familiar = 50% 正确, learning = 0% 正确
    let accuracy = 0
    if (userWords && userWords.length > 0) {
      const totalAccuracy = userWords.reduce((sum: number, w: any) => {
        if (w.mastery_status === 'mastered') return sum + 100
        if (w.mastery_status === 'familiar') return sum + 50
        return sum // learning = 0
      }, 0)
      accuracy = Math.round(totalAccuracy / userWords.length)
    }

    // 4. Streak: 从 user_profiles 获取连胜天数
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_streak')
      .eq('id', userId)
      .single()

    const streak = profile?.current_streak || 0

    // 🔥 每日目标：20 个单词（基于复习数，不含新学）
    const DAILY_GOAL = 20
    const goalAchieved = reviewedToday >= DAILY_GOAL

    const stats = {
      dueWords,
      reviewed: reviewedToday,      // 🔥 V3.0: 使用修正后的 reviewedToday
      newWords: newWordsToday,      // 🔥 V3.0: 新增字段
      accuracy,
      streak,
      goalAchieved,
      dailyGoal: DAILY_GOAL
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('[Stats API] ❌ 错误:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
