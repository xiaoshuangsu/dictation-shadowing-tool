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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[Supabase] URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING')
  console.log('[Supabase] Key present:', !!supabaseAnonKey)
  const isValidFormat = supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_publishable')
  console.log('[Supabase] Key format valid:', isValidFormat)
}

// Runtime validation (browser only, not during build)
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    '[Supabase] Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
  )
}

// Use placeholder values during build time if env vars are not available
const clientUrl = supabaseUrl || 'https://placeholder.supabase.co'
const clientKey = supabaseAnonKey || 'placeholder-key'

export const supabase = createClient(
  clientUrl,
  clientKey,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

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
  materialId?: string  // 添加 materialId 参数
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
      material_id: data.materialId || null,  // 添加 material_id 字段
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
  lastPracticedSentenceIndex?: number  // 最后练习的句子索引（0-based）
  materialId?: string  // 素材 ID
  slug?: string  // 素材的友好 slug（用于 URL 路由），如果没有则使用 materialId
  sentenceIds?: number[]  // 已完成的句子ID列表（排序后）
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
  console.log(`📊 [Progress] Fetching progress for user ${userId}, mode ${practiceMode}`)

  // 1. 获取用户的所有练习记录（包含material_id, sentence_id和completed_at）
  // 注意：不过滤 material_id 为 null 的记录，以支持旧数据
  const { data: records, error } = await supabase
    .from('practice_records')
    .select('material_id, audio_title, sentence_id, completed_at')
    .eq('user_id', userId)
    .eq('practice_mode', practiceMode)
    .order('completed_at', { ascending: false })

  console.log(`📊 [Progress] Query result:`, { error, recordsCount: records?.length || 0, recordsSample: records?.slice(0, 3) })

  if (error) {
    console.error('❌ [Progress] Failed to fetch practice records:', error)
    return []
  }

  if (!records || records.length === 0) {
    console.log(`⚠️ [Progress] No records found for ${practiceMode}`)
    return []
  }

  console.log(`📈 [Progress] Found ${records.length} total records for ${practiceMode}`)

  // 2. 获取所有素材的信息（用于后续匹配）
  const { data: materials } = await supabase
    .from('materials')
    .select('id, title, transcript, thumbnail_path')

  console.log(`📊 [Progress] Materials query:`, { materialsCount: materials?.length || 0 })

  if (!materials || materials.length === 0) {
    console.warn('⚠️ [Progress] No materials found')
    return []
  }

  // 创建 material_id -> 详细信息的映射
  const materialInfo = new Map<string, {
    sentenceCount: number
    thumbnail: string | null
    title: string
  }>()
  for (const material of materials) {
    const sentenceCount = material.transcript?.length || 0
    materialInfo.set(material.id, {
      sentenceCount,
      thumbnail: material.thumbnail_path,
      title: material.title
    })
  }

  // 创建 title -> material_id 的映射（用于旧记录匹配）
  const titleToMaterialId = new Map<string, string>()
  for (const material of materials) {
    titleToMaterialId.set(material.title, material.id)
  }

  // 3. 客户端聚合（按 material_id 分组，使用Set去重句子ID）
  // 对于 material_id 为 null 的旧记录，通过 audio_title 匹配找到对应的 material_id
  const materialMap = new Map<string, {
    uniqueSentences: Set<number>
    lastAt: string
    lastSentenceIndex: number
    audioTitle: string
  }>()

  for (const record of records) {
    const materialId = record.material_id
    const sentenceId = record.sentence_id
    const audioTitle = record.audio_title || 'Unknown'

    // 如果 material_id 为 null，尝试通过 audio_title 匹配
    let resolvedMaterialId = materialId
    if (!materialId) {
      resolvedMaterialId = titleToMaterialId.get(audioTitle) || audioTitle
      console.log(`🔍 [Progress] Old record: "${audioTitle}" (sentence ${sentenceId}) -> matched to material_id: ${resolvedMaterialId}`)
    } else {
      console.log(`✅ [Progress] New record: material_id=${materialId}, audio_title="${audioTitle}" (sentence ${sentenceId})`)
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

  // 4. 组合数据
  const result: MaterialProgress[] = []

  Array.from(materialMap.entries()).forEach(([resolvedMaterialId, { uniqueSentences, lastAt, lastSentenceIndex, audioTitle }]) => {
    const info = materialInfo.get(resolvedMaterialId)
    const totalSentences = info?.sentenceCount || 0
    const completedSentences = uniqueSentences.size
    const thumbnail = info?.thumbnail
    const title = info?.title || audioTitle  // 优先使用 materials.title，回退到 audio_title

    console.log(`📊 [Progress] Processing material:`, {
      resolvedMaterialId,
      title,
      audioTitle,
      totalSentences,
      completedSentences
    })

    result.push({
      audioTitle: title,  // 使用 materials.title
      totalSentences,
      completedSentences,
      lastPracticedAt: lastAt,
      practiceMode,
      thumbnail,
      lastPracticedSentenceIndex: lastSentenceIndex,
      materialId: resolvedMaterialId,
      slug: resolvedMaterialId,  // 使用 resolvedMaterialId 作为 slug
      sentenceIds: Array.from(uniqueSentences).sort((a, b) => a - b)
    })

    console.log(`✅ [Progress] ${title}: ${completedSentences}/${totalSentences} (${totalSentences > 0 ? Math.round(completedSentences/totalSentences*100) : 0}%)`)
    console.log(`   Material ID: ${resolvedMaterialId}`)
    console.log(`   Sentence IDs: [${Array.from(uniqueSentences).sort((a, b) => a - b).join(', ')}]`)
  })

  console.log(`📊 [Progress] Final result count: ${result.length}`)

  // 打印每个素材的详细信息
  result.forEach((item, index) => {
    console.log(`📊 [Progress] Result[${index}]:`, {
      audioTitle: item.audioTitle,
      materialId: item.materialId,
      slug: item.slug,
      totalSentences: item.totalSentences,
      completedSentences: item.completedSentences,
      lastPracticedAt: item.lastPracticedAt
    })
  })

  // 按最后练习时间排序
  result.sort((a, b) =>
    new Date(b.lastPracticedAt).getTime() - new Date(a.lastPracticedAt).getTime()
  )

  return result
}
