/**
 * Supabase Client Initialization
 **/
// @ts-nocheck
/**
 * Supabase Client Initialization
 *
 * This file initializes the Supabase client for authentication and data storage.
 * Environment variables are loaded from .env.local (development) or
 * deployment platform environment variables (production).
 *
 * Get your credentials from: https://supabase.com/dashboard/project/_/settings/api
 *
 * IMPORTANT: The following environment variables MUST be set:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY (can be JWT format "eyJ..." or legacy "sb_publishable..." format)
 */

import { createClient } from '@supabase/supabase-js'

// Hardcoded credentials for static export
const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'

// Implement singleton pattern to avoid multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createClient> | null = null

/**
 * Get Supabase client instance (singleton pattern)
 *
 * Ensures the entire application has only one Supabase client instance, avoiding:
 * - Multiple GoTrueClient instance conflicts
 * - Authentication state inconsistency
 * - Loading freezing issues
 *
 * Error handling: Credentials missing will not throw errors
 */
export const getSupabase = () => {
  // Error handling: Check if credentials exist
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing credentials, using hardcoded values')
  }

  if (!supabaseInstance) {
    // Create new instance
    supabaseInstance = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          autoRefreshToken: false,  // 🔥 禁用自动刷新，避免超时
          persistSession: false,    // 🔥 禁用持久化，减少连接压力
          detectSessionInUrl: false,
        },
      }
    )
  }

  return supabaseInstance
}

// Backward compatibility: Export default supabase instance
export const supabase = getSupabase()
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
  is_premium: boolean
  source_type: 'r2' | 'youtube'
  youtube_id?: string | null
  video_path?: string | null
  transcript?: any
}

export interface UserWord {
  id: string
  user_id: string
  word: string
  phonetic: string | null
  definition: string
  context_sentence: string | null
  material_id: string | null
  material_title: string | null
  mastery_status: 'learning' | 'familiar' | 'mastered'
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
  materialId?: string
  durationSeconds?: number
}) {
  const { data: record, error } = await (supabase as any)
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
      material_id: data.materialId || null,
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
 * Material progress statistics interface
 */
export interface MaterialProgress {
  audioTitle: string
  totalSentences: number
  completedSentences: number
  lastPracticedAt: string
  practiceMode: 'dictation' | 'shadowing'
  thumbnail?: string | null
  lastPracticedSentenceIndex?: number
  materialId?: string
  slug?: string
  sentenceIds?: number[]
  category?: string
}

/**
 * Get user material progress (aggregated by material, using efficient SQL query)
 */
export async function getMaterialProgress(
  userId: string,
  practiceMode: 'dictation' | 'shadowing'
): Promise<MaterialProgress[]> {
  const { data, error } = await (supabase as any)
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
 * Fallback: Use client-side aggregation (if SQL function not available)
 */
export async function getMaterialProgressFallback(
  userId: string,
  practiceMode: 'dictation' | 'shadowing'
): Promise<MaterialProgress[]> {
  const { data: records, error } = await supabase
    .from('practice_records')
    .select('material_id, audio_title, sentence_id, completed_at')
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

  const { data: materials } = await supabase
    .from('materials')
    .select('id, title, category, transcript, thumbnail_path')

  if (!materials || materials.length === 0) {
    return []
  }

  const materialInfo = new Map<string, {
    sentenceCount: number
    skippableCount: number
    thumbnail: string | null
    title: string
    category: string
  }>()
  for (const material of materials as any[]) {
    const transcript = material.transcript || []
    const sentenceCount = transcript.length

    const skippableCount = transcript.filter((s: any) => {
      return !s.blanks || !Array.isArray(s.blanks) || s.blanks.length === 0
    }).length

    materialInfo.set(material.id, {
      sentenceCount,
      skippableCount,
      thumbnail: material.thumbnail_path,
      title: material.title,
      category: material.category || '未分类'
    })
  }

  const titleToMaterialId = new Map<string, string>()
  for (const material of materials as any[]) {
    titleToMaterialId.set(material.title, material.id)
  }

  const materialMap = new Map<string, {
    uniqueSentences: Set<number>
    lastAt: string
    lastSentenceIndex: number
    audioTitle: string
  }>()

  for (const record of records as any[]) {
    const materialId = record.material_id
    const sentenceId = record.sentence_id
    const audioTitle = record.audio_title || 'Unknown'

    let resolvedMaterialId = materialId
    if (!materialId) {
      resolvedMaterialId = titleToMaterialId.get(audioTitle) || audioTitle
    }

    const current = materialMap.get(resolvedMaterialId)

    if (current) {
      current.uniqueSentences.add(sentenceId)
      if (sentenceId - 1 > current.lastSentenceIndex) {
        current.lastSentenceIndex = sentenceId - 1
      }
      if (record.completed_at > current.lastAt) {
        current.lastAt = record.completed_at
      }
    } else {
      const uniqueSentences = new Set<number>()
      uniqueSentences.add(sentenceId)
      materialMap.set(resolvedMaterialId, {
        uniqueSentences,
        lastAt: record.completed_at,
        lastSentenceIndex: sentenceId - 1,
        audioTitle
      })
    }
  }

  const result: MaterialProgress[] = []

  Array.from(materialMap.entries()).forEach(([resolvedMaterialId, { uniqueSentences, lastAt, lastSentenceIndex, audioTitle }]) => {
    const info = materialInfo.get(resolvedMaterialId)
    const totalSentences = info?.sentenceCount || 0
    const skippableCount = info?.skippableCount || 0
    const practicedSentences = uniqueSentences.size

    const completedSentences = practicedSentences + skippableCount

    const thumbnail = info?.thumbnail
    const title = info?.title || audioTitle

    result.push({
      audioTitle: title,
      totalSentences,
      completedSentences,
      lastPracticedAt: lastAt,
      practiceMode,
      thumbnail,
      lastPracticedSentenceIndex: lastSentenceIndex,
      materialId: resolvedMaterialId,
      slug: resolvedMaterialId,
      sentenceIds: Array.from(uniqueSentences).sort((a, b) => a - b),
      category: info?.category || '未分类'
    })
  })

  result.sort((a, b) =>
    new Date(b.lastPracticedAt).getTime() - new Date(a.lastPracticedAt).getTime()
  )

  return result
}
