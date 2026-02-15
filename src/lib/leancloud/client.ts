/**
 * LeanCloud Client Initialization
 *
 * This file initializes the LeanCloud SDK for authentication and data storage.
 * Environment variables are loaded from .env.local (development) or
 * Cloudflare Pages environment variables (production).
 *
 * Get your credentials from: https://console.leancloud.cn/apps -> 设置 -> 应用凭证
 *
 * TEST MODE: If credentials are not configured, uses mock implementation with localStorage.
 */

// Check if we have real LeanCloud credentials
const appId = process.env.NEXT_PUBLIC_LEANCLOUD_APP_ID
const appKey = process.env.NEXT_PUBLIC_LEANCLOUD_APP_KEY
const serverUrl = process.env.NEXT_PUBLIC_LEANCLOUD_SERVER_URL
const hasCredentials = appId && appKey && serverUrl && appId !== 'your_app_id_here'

// Import real or mock implementation based on credentials
let AV: any
if (hasCredentials) {
  // Real LeanCloud
  const RealAV = require('leancloud-storage')
  RealAV.init({
    appId,
    appKey,
    serverURL: serverUrl,
  })
  AV = RealAV
} else {
  // Mock LeanCloud for testing
  if (typeof window !== 'undefined') {
    console.log('🧪 TEST MODE: Using mock LeanCloud (localStorage)')
  }
  const mock = require('./mock')
  AV = mock.AV
}

/**
 * Export the initialized AV instance for use throughout the app
 * You can import this as: import AV from '@/lib/leancloud/client'
 */
export default AV

/**
 * Export TypeScript types for LeanCloud objects
 */
export { User, Query, Object } from 'leancloud-storage'

/**
 * Type definitions for our custom LeanCloud classes
 */

// PracticeRecord class - stores individual practice sessions
export interface PracticeRecordData {
  user: any // Pointer to _User
  sentenceId: number
  sentenceText: string
  practiceMode: 'dictation' | 'shadowing'
  dictationMode?: 'word' | 'whole'
  isCorrect: boolean
  usedShowWords: boolean
  audioTitle: string
  completedAt: Date
}

// UserStats class - caches user statistics for faster queries
export interface UserStatsData {
  user: any // Pointer to _User
  totalPractices: number
  totalCorrect: number
  todayPractices: number
  lastPracticeDate: string // YYYY-MM-DD format
}

/**
 * Helper function to create a new PracticeRecord
 */
export function createPracticeRecord(data: PracticeRecordData) {
  const PracticeRecord = AV.Object.extend('PracticeRecord')
  const record = new PracticeRecord()

  record.set('user', data.user)
  record.set('sentenceId', data.sentenceId)
  record.set('sentenceText', data.sentenceText)
  record.set('practiceMode', data.practiceMode)
  if (data.dictationMode) {
    record.set('dictationMode', data.dictationMode)
  }
  record.set('isCorrect', data.isCorrect)
  record.set('usedShowWords', data.usedShowWords)
  record.set('audioTitle', data.audioTitle)
  record.set('completedAt', data.completedAt)

  // Set ACL - only the user can read/write their own data
  const acl = new AV.ACL()
  acl.setPublicReadAccess(false)
  acl.setPublicWriteAccess(false)
  // LeanCloud ACL will automatically grant the owner (current user) full access
  record.setACL(acl)

  return record
}

/**
 * Helper function to query user statistics
 */
export async function getUserStats(user: any): Promise<UserStatsData | null> {
  try {
    const query = new AV.Query('UserStats')
    query.equalTo('user', user)
    const stats = await query.first()

    if (!stats) {
      return null
    }

    return {
      user: stats.get('user'),
      totalPractices: stats.get('totalPractices') || 0,
      totalCorrect: stats.get('totalCorrect') || 0,
      todayPractices: stats.get('todayPractices') || 0,
      lastPracticeDate: stats.get('lastPracticeDate') || '',
    }
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return null
  }
}

/**
 * Helper function to query recent practice records
 */
export async function getRecentPracticeRecords(
  user: any,
  limit: number = 10
): Promise<Array<PracticeRecordData & { id: string }>> {
  try {
    const query = new AV.Query('PracticeRecord')
    query.equalTo('user', user)
    query.descending('createdAt')
    query.limit(limit)

    const records = await query.find()

    return records.map((record: any) => ({
      id: record.id!,
      user: record.get('user'),
      sentenceId: record.get('sentenceId'),
      sentenceText: record.get('sentenceText'),
      practiceMode: record.get('practiceMode'),
      dictationMode: record.get('dictationMode'),
      isCorrect: record.get('isCorrect'),
      usedShowWords: record.get('usedShowWords'),
      audioTitle: record.get('audioTitle'),
      completedAt: record.get('completedAt') || record.createdAt!,
    }))
  } catch (error) {
    console.error('Error fetching practice records:', error)
    return []
  }
}
