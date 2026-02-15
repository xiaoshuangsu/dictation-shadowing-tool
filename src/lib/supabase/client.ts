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

// Debug: Log environment variables
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Key present:', !!supabaseAnonKey)
}

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error(
      'Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
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
  completed_at: string
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
 * Helper function to get user statistics
 */
export async function getUserStats(userId: string) {
  // Get total practices
  const { count: totalPractices } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Get total correct
  const { count: totalCorrect } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_correct', true)

  // Get today's practices
  const today = new Date().toISOString().split('T')[0]
  const { count: todayPractices } = await supabase
    .from('practice_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', today)

  return {
    totalPractices: totalPractices || 0,
    totalCorrect: totalCorrect || 0,
    todayPractices: todayPractices || 0,
    averageAccuracy: totalPractices
      ? Math.round(((totalCorrect || 0) / totalPractices) * 100)
      : 0,
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
