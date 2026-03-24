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

// 🔴 关键修复：实施单例模式，避免多个 GoTrueClient 实例冲突
let supabaseInstance: ReturnType<typeof createClient> | null = null

/**
 * 获取 Supabase 客户端实例（单例模式）
 *
 * 确保整个应用只有一个 Supabase 客户端实例，避免：
 * - 多个 GoTrueClient 实例冲突
 * - 认证状态不一致
 * - 加载卡死问题
 *
 * 容错处理：即使凭证缺失也不会抛出错误
 */
export const getSupabase = () => {
  // 🔴 容错处理：检查凭证是否存在
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] ⚠️  Missing credentials, using hardcoded values')
  }

  if (!supabaseInstance) {
    // 🔴 在构建期间（SSG），创建静默版本避免错误
    const isBuildTime = typeof window === 'undefined'

    if (isBuildTime) {
      console.log('[Supabase] Creating singleton instance (build time)')
    } else {
      console.log('[Supabase] Creating singleton instance (browser)')
    }

    supabaseInstance = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    )

    // Debug logging (仅在浏览器环境)
    if (typeof window !== 'undefined') {
      console.log('[Supabase] URL:', supabaseUrl.substring(0, 30) + '...')
      console.log('[Supabase] Key present:', !!supabaseAnonKey)
      const isValidFormat = supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_publishable')
      console.log('[Supabase] Key format valid:', isValidFormat)
    }
  } else {
    console.log('[Supabase] Reusing existing singleton instance')
  }

  return supabaseInstance
}

// 向后兼容：导出默认的 supabase 实例
// 使用 getter 函数确保总是返回同一个实例
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
  is_premium: boolean  // 是否为付费素材
  // 新增字段：支持 YouTube 和 R2 视频
  source_type: 'r2' | 'youtube'
  youtube_id?: string | null
  video_path?: string | null
  transcript?: any  // JSONB 类型，存储句子级别的转录数据
}

export interface UserWord {
  id: string
  user_id: string
  word: string
  phonetic: string | null
  definition: string  // JSON 格式：{"zh": "你好", "vi": "xin chào"}
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
  materialId?: string  // 添加 materialId 参数
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
  category?: string  // 素材分类
}

/**
 * 获取用户的素材进度（按素材聚合，使用高效的SQL查询）
 */
export async function getMaterialProgress(
  userId: string,
  practiceMode: 'dictation' | 'shadowing'
): Promise<MaterialProgress[]> {
  // 使用 Supabase RPC 调用自定义 SQL 函数（最高效）
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
    .select('id, title, category, transcript, thumbnail_path')

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
    category: string
  }>()
  for (const material of materials as any[]) {
    const sentenceCount = material.transcript?.length || 0
    materialInfo.set(material.id, {
      sentenceCount,
      thumbnail: material.thumbnail_path,
      title: material.title,
      category: material.category || '未分类'
    })
  }

  // 创建 title -> material_id 的映射（用于旧记录匹配）
  const titleToMaterialId = new Map<string, string>()
  for (const material of materials as any[]) {
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

  for (const record of records as any[]) {
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
      sentenceIds: Array.from(uniqueSentences).sort((a, b) => a - b),
      category: info?.category || '未分类'
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
