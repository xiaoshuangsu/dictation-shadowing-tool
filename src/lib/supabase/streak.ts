/**
 * V3 数据留存系统 - 连胜和统计数据访问层
 *
/
// @ts-nocheck
/**
 * V3 数据留存系统 - 连胜和统计数据访问层
 *
 * 核心功能：
 * 1. 连胜系统（Streak）
 * 2. 累计统计
 * 3. 每日记录
 */

import { supabase } from './client'

// ============================================
// 类型定义
// ============================================

export interface UserStats {
  user_id: string
  total_dictation_sentences: number
  total_dictation_minutes: number
  total_shadowing_minutes: number
  total_shadowing_sessions: number
}

export interface DailyRecord {
  id: string
  user_id: string
  date: string
  dictation_count: number
  shadowing_minutes: number
  completed: boolean
  created_at: string
  updated_at: string
}

export interface StreakData {
  current_streak: number
  max_streak: number
  last_completed_date: string | null
}

// ============================================
// 1. 累计统计相关函数
// ============================================

/**
 * 获取用户累计统计数据
 * Shadowing 总时间从 practice_records 表的 duration_seconds 计算
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  // 获取 user_stats 表的数据
  const { data: statsData, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (statsError) {
    console.error('Failed to fetch user stats:', statsError)
    return null
  }

  // 从 practice_records 表计算真实的 Shadowing 总时间（秒）
  const { data: shadowingTimeData, error: shadowingTimeError } = await supabase
    .from('practice_records')
    .select('duration_seconds')
    .eq('user_id', userId)
    .eq('practice_mode', 'shadowing')

  if (shadowingTimeError) {
    console.error('Failed to fetch shadowing duration:', shadowingTimeError)
  }

  // 累计所有 Shadowing 记录的 duration_seconds，转换为分钟
  const totalShadowingSeconds = (shadowingTimeData || [])
    .reduce((sum: number, record: any) => sum + (record.duration_seconds || 0), 0)

  const totalShadowingMinutes = Math.ceil(totalShadowingSeconds / 60)

  console.log('getUserStats - Calculated shadowing time:', {
    totalShadowingSeconds,
    totalShadowingMinutes,
    recordCount: shadowingTimeData?.length || 0
  })

  // 返回混合数据：user_stats + 计算的 Shadowing 时间
  return {
    ...(statsData as any || {}),
    total_shadowing_minutes: totalShadowingMinutes,
  }
}

/**
 * 初始化用户统计数据（新用户注册时调用）
 */
export async function initializeUserStats(userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('user_stats')
    .insert({
      user_id: userId,
      total_dictation_sentences: 0,
      total_dictation_minutes: 0,
      total_shadowing_minutes: 0,
      total_shadowing_sessions: 0,
    })

  if (error) {
    console.error('Failed to initialize user stats:', error)
    throw error
  }
}

/**
 * 更新累计统计数据 - Dictation（带时长）
 */
export async function updateDictationStats(userId: string, minutes: number = 0): Promise<void> {
  console.log('updateDictationStats - Starting:', { userId, minutes })

  // 使用 RPC 函数原子性地累加统计（支持浮点数累加，最后取整）
  const { error } = await (supabase as any).rpc('increment_user_stats_dictation', {
    p_user_id: userId,
    p_minutes: minutes, // 保持浮点数精度
  })

  if (error) {
    console.error('Failed to update dictation stats:', error)
    // 如果 RPC 函数不存在，回退到普通方法
    console.log('RPC not found, falling back to direct query...')

    const { data: currentStats } = await (supabase as any)
      .from('user_stats')
      .select('total_dictation_sentences, total_dictation_minutes')
      .eq('user_id', userId)
      .single()

    if (!currentStats) {
      await initializeUserStats(userId)
      return
    }

    // 累加所有句子的实际时间后再取整
    const newMinutes = Math.ceil((currentStats.total_dictation_minutes || 0) + minutes)

    const { error: updateError } = await (supabase as any)
      .from('user_stats')
      .update({
        total_dictation_sentences: (currentStats.total_dictation_sentences || 0) + 1,
        total_dictation_minutes: newMinutes,
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to update dictation stats:', updateError)
      throw updateError
    }
  } else {
    console.log('Dictation stats updated successfully via RPC')
  }
}

/**
 * 更新累计统计数据 - Shadowing
 */
export async function updateShadowingStats(
  userId: string,
  minutes: number
): Promise<void> {
  console.log('updateShadowingStats - Starting:', { userId, minutes })

  // 使用 RPC 函数原子性地累加统计（支持浮点数累加，最后取整）
  const { error } = await (supabase as any).rpc('increment_user_stats_shadowing', {
    p_user_id: userId,
    p_minutes: minutes, // 保持浮点数精度
  })

  if (error) {
    console.error('Failed to update shadowing stats:', error)
    // 如果 RPC 函数不存在，回退到普通方法
    console.log('RPC not found, falling back to direct query...')

    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('total_shadowing_minutes, total_shadowing_sessions')
      .eq('user_id', userId)
      .single()

    if (!currentStats) {
      console.log('updateShadowingStats - No stats found, initializing...')
      await initializeUserStats(userId)
      return
    }

    // 累加所有句子的实际时间后再取整
    const newMinutes = Math.ceil(currentStats.total_shadowing_minutes + minutes)
    const newSessions = currentStats.total_shadowing_sessions + 1

    console.log('updateShadowingStats - Updating to:', { totalMinutes: currentStats.total_shadowing_minutes + minutes, roundedMinutes: newMinutes, newSessions })

    const { error: updateError } = await supabase
      .from('user_stats')
      .update({
        total_shadowing_minutes: newMinutes,
        total_shadowing_sessions: newSessions,
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to update shadowing stats:', updateError)
      throw updateError
    }
  } else {
    console.log('Shadowing stats updated successfully via RPC')
  }
}

// ============================================
// 2. 每日记录相关函数
// ============================================

/**
 * 获取或创建今天的每日记录
 */
export async function getOrCreateTodayRecord(userId: string): Promise<DailyRecord> {
  const today = new Date().toISOString().split('T')[0]

  // 先尝试获取今天的记录
  const { data: existingRecord, error: fetchError } = await supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (existingRecord) {
    return existingRecord
  }

  // 如果不存在，创建新记录
  const { data, error } = await supabase
    .from('daily_records')
    .insert({
      user_id: userId,
      date: today,
      dictation_count: 0,
      shadowing_minutes: 0,
      completed: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create daily record:', error)
    throw error
  }

  return data
}

/**
 * 更新今日 Dictation 计数
 */
export async function updateTodayDictation(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // 使用 PostgreSQL 原子操作累加计数
  const { error } = await (supabase as any).rpc('increment_today_dictation', {
    p_user_id: userId,
    p_date: today,
  })

  if (error) {
    console.error('Failed to update today dictation count:', error)
    // 如果 RPC 函数不存在，回退到普通方法
    console.log('RPC not found, falling back to direct upsert...')

    // 回退方案：直接查询并累加
    const { data: existingRecord } = await supabase
      .from('daily_records')
      .select('id, dictation_count')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    if (existingRecord) {
      // 记录已存在，累加计数
      const { error: updateError } = await supabase
        .from('daily_records')
        .update({
          dictation_count: existingRecord.dictation_count + 1,
        })
        .eq('id', existingRecord.id)

      if (updateError) {
        console.error('Failed to update dictation count:', updateError)
      }
    } else {
      // 记录不存在，创建新记录
      const { error: insertError } = await supabase
        .from('daily_records')
        .insert({
          user_id: userId,
          date: today,
          dictation_count: 1,
          shadowing_minutes: 0,
          completed: false,
        })

      if (insertError) {
        console.error('Failed to insert daily record:', insertError)
      }
    }
  } else {
    console.log('Today dictation count updated successfully via RPC')
  }
}

/**
 * 更新今日 Shadowing 分钟数
 */
export async function updateTodayShadowing(userId: string, minutes: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // 向上取整到整数（数据库字段是 INTEGER 类型）
  const minutesInt = Math.ceil(minutes)

  // 使用 PostgreSQL 原子操作累加时间
  const { error } = await (supabase as any).rpc('increment_today_shadowing', {
    p_user_id: userId,
    p_date: today,
    p_minutes: minutesInt,
  })

  if (error) {
    console.error('Failed to update today shadowing minutes:', error)
    // 如果 RPC 函数不存在，回退到普通方法
    console.log('RPC not found, falling back to direct upsert...')

    // 回退方案：直接查询并累加
    const { data: existingRecord } = await supabase
      .from('daily_records')
      .select('id, shadowing_minutes')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    if (existingRecord) {
      // 记录已存在，累加时间
      const { error: updateError } = await supabase
        .from('daily_records')
        .update({
          shadowing_minutes: existingRecord.shadowing_minutes + minutesInt,
        })
        .eq('id', existingRecord.id)

      if (updateError) {
        console.error('Failed to update shadowing minutes:', updateError)
      }
    } else {
      // 记录不存在，创建新记录
      const { error: insertError } = await supabase
        .from('daily_records')
        .insert({
          user_id: userId,
          date: today,
          dictation_count: 0,
          shadowing_minutes: minutesInt,
          completed: false,
        })

      if (insertError) {
        console.error('Failed to insert daily record:', insertError)
      }
    }
  } else {
    console.log('Today shadowing minutes updated successfully via RPC')
  }
}

/**
 * 获取最近 N 天的每日记录
 */
export async function getRecentDailyRecords(
  userId: string,
  days: number = 30
): Promise<DailyRecord[]> {
  const { data, error } = await supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(days)

  if (error) {
    console.error('Failed to fetch recent daily records:', error)
    return []
  }

  return data || []
}

// ============================================
// 3. 连胜系统相关函数
// ============================================

/**
 * 获取用户连胜数据
 */
export async function getUserStreak(userId: string): Promise<StreakData | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('current_streak, max_streak, last_completed_date')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch user streak:', error)
    return null
  }

  return data
}

/**
 * 获取用户完整档案（包含连胜和统计数据）
 */
export async function getUserCompleteProfile(userId: string): Promise<{
  streak: StreakData | null
  stats: UserStats | null
  todayRecord: DailyRecord | null
}> {
  const [streak, stats, todayRecord] = await Promise.all([
    getUserStreak(userId),
    getUserStats(userId),
    getOrCreateTodayRecord(userId),
  ])

  return {
    streak,
    stats,
    todayRecord,
  }
}

// ============================================
// 4. 综合函数 - 练习完成时调用
// ============================================

/**
 * Dictation 完成时的完整数据处理
 */
export async function onDictationComplete(userId: string, minutes: number = 0): Promise<void> {
  try {
    // 1. 更新累计统计
    await updateDictationStats(userId, minutes)

    // 2. 更新今日记录
    await updateTodayDictation(userId)

    // 3. 连胜判断由数据库触发器自动处理
    console.log('Dictation data saved successfully')
  } catch (error) {
    console.error('Failed to save dictation data:', error)
    throw error
  }
}

/**
 * Shadowing 完成时的完整数据处理
 */
export async function onShadowingComplete(userId: string, minutes: number): Promise<void> {
  try {
    console.log('onShadowingComplete - Starting:', { userId, minutes })

    // 1. 更新累计统计
    await updateShadowingStats(userId, minutes)

    // 2. 更新今日记录
    await updateTodayShadowing(userId, minutes)

    // 3. 连胜判断由数据库触发器自动处理
    console.log('Shadowing data saved successfully')
  } catch (error) {
    console.error('Failed to save shadowing data:', error)
    throw error
  }
}

/**
 * 检查今天是否已完成学习目标
 */
export async function checkTodayCompleted(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_records')
    .select('completed')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (error || !data) {
    return false
  }

  return data.completed
}

/**
 * 获取本周的每日记录（用于日历视图）
 */
export async function getWeeklyRecords(userId: string): Promise<DailyRecord[]> {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay()) // 周日
  startOfWeek.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startOfWeek.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) {
    console.error('Failed to fetch weekly records:', error)
    return []
  }

  return data || []
}
