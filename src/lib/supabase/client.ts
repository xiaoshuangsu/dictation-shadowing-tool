/**
 * Supabase Client Initialization
 *
 * This file initializes the Supabase client for authentication and data storage.
 * Environment variables are loaded from .env.local (development) or
 * deployment platform environment variables (production).
 *
 * Get your credentials from: https://supabase.com/dashboard/project/_/settings/api
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error(
      'Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

// Debug: Log initialization
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Key present:', !!supabaseAnonKey)
  console.log('Supabase client initialized')
}

export default supabase

/**
 * Type definitions for our database tables
 */

export interface UserProfile {
  id: string
  username: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface PracticeRecord {
  id: string
  user_id: string
  sentence_id: number
  sentence_text: string
  practice_mode: 'dictation' | 'shadowing'
  dictation_mode: 'word' | 'whole' | null
  is_correct: boolean
  used_show_words: boolean
  audio_title: string
  duration_seconds: number | null
  completed_at: string
}

export interface Material {
  id: string
  title: string
  category: string
  difficulty: 'A1' | 'A2' | 'B1' | 'B2'
  audio_path: string
  thumbnail_path: string | null
  audio_size: number
  duration: number | null
  play_count: number
  created_at: string
  updated_at: string
}

/**
 * Helper function to save a practice record
 */
export async function savePracticeRecord(data: {
  userId: string
  sentenceId: number
  sentenceText: string
  practiceMode: 'dictation' | 'shadowing'
  dictationMode?: 'word' | 'whole'
  isCorrect: boolean
  usedShowWords: boolean
  audioTitle: string
  durationSeconds?: number
}) {
  const { data: record, error } = await supabase
    .from('practice_records')
    .insert({
      user_id: data.userId,
      sentence_id: data.sentenceId,
      sentence_text: data.sentenceText,
      practice_mode: data.practiceMode,
      dictation_mode: data.dictationMode || null,
      is_correct: data.isCorrect,
      used_show_words: data.usedShowWords,
      audio_title: data.audioTitle,
      duration_seconds: data.durationSeconds || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to save practice record:', error)
    throw error
  }

  return record
}

/**
 * Helper function to get user statistics (separated by mode)
 */
export async function getUserStats(userId: string) {
  const today = new Date().toISOString().split('T')[0]

  // Dictation stats
  const { count: dictationTotal } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('practice_mode', 'dictation')

  const { count: dictationCorrect } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('practice_mode', 'dictation')
    .eq('is_correct', true)

  const { count: dictationToday } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('practice_mode', 'dictation')
    .gte('completed_at', today)

  // Shadowing stats
  const { count: shadowingTotal } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('practice_mode', 'shadowing')

  const { count: shadowingCorrect } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('practice_mode', 'shadowing')
    .eq('is_correct', true)

  const { count: shadowingToday } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('practice_mode', 'shadowing')
    .gte('completed_at', today)

  return {
    dictation: {
      totalPractices: dictationTotal || 0,
      averageAccuracy: dictationTotal
        ? Math.round(((dictationCorrect || 0) / dictationTotal) * 100)
        : 0,
      todayPractices: dictationToday || 0,
    },
    shadowing: {
      totalPractices: shadowingTotal || 0,
      averageAccuracy: shadowingTotal
        ? Math.round(((shadowingCorrect || 0) / shadowingTotal) * 100)
        : 0,
      todayPractices: shadowingToday || 0,
    },
  }
}

/**
 * Helper function to get recent practice records
 */
export async function getRecentPracticeRecords(
  userId: string,
  limit: number = 10
): Promise<PracticeRecord[]> {
  const { data, error } = await supabase
    .from('practice_records')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch practice records:', error)
    return []
  }

  return data || []
}

/**
 * Helper function to get user profile
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }

  return data
}

/**
 * 素材进度统计接口
 */
export interface MaterialProgress {
  audioTitle: string
  totalSentences: number
  completedSentences: number
  lastPracticedAt: string
  practiceMode: 'dictation' | 'shadowing'
  thumbnail?: string | null
}

/**
 * 获取用户的素材进度（按素材聚合，使用高效的SQL查询）
 */
export async function getMaterialProgress(
  userId: string,
  practiceMode: 'dictation' | 'shadowing'
): Promise<MaterialProgress[]> {
  // 使用 Supabase RPC 调用自定义 SQL 函数（最高效）
  const { data, error } = await supabase
    .rpc('get_material_progress', {
      p_user_id: userId,
      p_practice_mode: practiceMode
    })

  if (error) {
    console.error('Failed to fetch material progress:', error)
    return []
  }

  return data || []
}

/**
 * 备用方案：使用客户端聚合（如果没有SQL函数）
 */
export async function getMaterialProgressFallback(
  userId: string,
  practiceMode: 'dictation' | 'shadowing'
): Promise<MaterialProgress[]> {
  // 1. 获取用户的所有练习记录（包含sentence_id用于去重）
  const { data: records, error } = await supabase
    .from('practice_records')
    .select('audio_title, sentence_id, completed_at')
    .eq('user_id', userId)
    .eq('practice_mode', practiceMode)
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch practice records:', error)
    return []
  }

  if (!records || records.length === 0) {
    return []
  }

  // 2. 客户端聚合（按素材分组，使用Set去重句子ID）
  const materialMap = new Map<string, { uniqueSentences: Set<number>; lastAt: string }>()

  for (const record of records) {
    const title = record.audio_title
    const sentenceId = record.sentence_id
    const current = materialMap.get(title)

    if (current) {
      // 使用Set自动去重句子ID
      current.uniqueSentences.add(sentenceId)
      // 保持最新的时间
      if (record.completed_at > current.lastAt) {
        current.lastAt = record.completed_at
      }
    } else {
      const uniqueSentences = new Set<number>()
      uniqueSentences.add(sentenceId)
      materialMap.set(title, {
        uniqueSentences,
        lastAt: record.completed_at
      })
    }
  }

  // 3. 获取所有素材的总句子数和缩略图
  const { data: materials } = await supabase
    .from('materials')
    .select('title, transcript, thumbnail_path')

  if (!materials) {
    return []
  }

  // 创建素材标题 -> 详细信息的映射
  const materialInfo = new Map<string, { sentenceCount: number; thumbnail: string | null }>()
  for (const material of materials) {
    const sentenceCount = material.transcript?.length || 0
    materialInfo.set(material.title, {
      sentenceCount,
      thumbnail: material.thumbnail_path
    })
  }

  // 4. 组合数据
  const result: MaterialProgress[] = []

  Array.from(materialMap.entries()).forEach(([audioTitle, { uniqueSentences, lastAt }]) => {
    const info = materialInfo.get(audioTitle)
    const totalSentences = info?.sentenceCount || 0
    const completedSentences = uniqueSentences.size // 使用Set的大小，自动去重
    const thumbnail = info?.thumbnail

    result.push({
      audioTitle,
      totalSentences,
      completedSentences,
      lastPracticedAt: lastAt,
      practiceMode,
      thumbnail
    })
  })

  // 按最后练习时间排序
  result.sort((a, b) =>
    new Date(b.lastPracticedAt).getTime() - new Date(a.lastPracticedAt).getTime()
  )

  return result
}
