/**
 * API Route: Topics 素材列表（物理脱离版本 - 完全硬编码）
 *
 * 🔥 物理脱离 Supabase：不依赖任何数据库连接
 * 所有数据均为硬编码静态 JSON
 */
import { NextResponse } from 'next/server'

// 硬编码分类列表
const CATEGORIES = [
  { id: '日常生活', label: 'Daily Life' },
  { id: 'Science and Facts', label: 'Science and Facts' },
  { id: 'BBC Earth', label: 'BBC Earth' },
  { id: '历史演讲', label: 'Historical Speeches' },
  { id: 'TED演讲', label: 'TED Talks' },
  { id: '文化历史', label: 'Culture & History' },
  { id: '心灵故事', label: 'Heart & Soul Stories' },
  { id: '艺术文化', label: 'Arts & Culture' },
  { id: '故事', label: 'Stories' },
  { id: '动画片', label: 'Cartoons' },
  { id: '人物访谈', label: 'Interviews' },
  { id: 'BBC Learning English', label: 'BBC Learning English' },
  { id: 'VOA Learning English', label: 'VOA Learning English' },
  { id: 'IELTS Listening', label: 'IELTS Listening' },
] as const

// 🔥 硬编码完整静态数据（脱离数据库）
const STATIC_DATA = {
  materialsByCategory: {
    '日常生活': [
      { id: 'daily-1', title: 'Daily Greeting', category: '日常生活', difficulty: 'A1', audio_path: null, thumbnail_path: null, duration: 120, audio_size: 1024, play_count: 0 },
      { id: 'daily-2', title: 'Ordering Food', category: '日常生活', difficulty: 'A2', audio_path: null, thumbnail_path: null, duration: 180, audio_size: 2048, play_count: 0 },
      { id: 'daily-3', title: 'Asking Directions', category: '日常生活', difficulty: 'A2', audio_path: null, thumbnail_path: null, duration: 150, audio_size: 1536, play_count: 0 },
      { id: 'daily-4', title: 'Weather Conversation', category: '日常生活', difficulty: 'A1', audio_path: null, thumbnail_path: null, duration: 90, audio_size: 900, play_count: 0 },
    ],
    'Science and Facts': [
      { id: 'science-1', title: 'Climate Change Basics', category: 'Science and Facts', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 300, audio_size: 4096, play_count: 0 },
      { id: 'science-2', title: 'Solar System', category: 'Science and Facts', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 420, audio_size: 5120, play_count: 0 },
    ],
    'BBC Earth': [
      { id: 'earth-1', title: 'Planet Earth', category: 'BBC Earth', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 600, audio_size: 8192, play_count: 0 },
      { id: 'earth-2', title: 'Ocean Life', category: 'BBC Earth', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 540, audio_size: 7168, play_count: 0 },
    ],
    '历史演讲': [
      { id: 'history-1', title: 'I Have a Dream', category: '历史演讲', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 900, audio_size: 10240, play_count: 0 },
      { id: 'history-2', title: 'Gettysburg Address', category: '历史演讲', difficulty: 'C1', audio_path: null, thumbnail_path: null, duration: 180, audio_size: 2048, play_count: 0 },
    ],
    'TED演讲': [
      { id: 'ted-1', title: 'The Power of Vulnerability', category: 'TED演讲', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 1200, audio_size: 15360, play_count: 0 },
      { id: 'ted-2', title: 'How Great Leaders Inspire', category: 'TED演讲', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 1080, audio_size: 12288, play_count: 0 },
    ],
    '文化历史': [
      { id: 'culture-1', title: 'The Great Wall', category: '文化历史', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 480, audio_size: 6144, play_count: 0 },
      { id: 'culture-2', title: 'Egyptian Pyramids', category: '文化历史', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 540, audio_size: 7168, play_count: 0 },
    ],
    '心灵故事': [
      { id: 'soul-1', title: 'The Giving Tree', category: '心灵故事', difficulty: 'A2', audio_path: null, thumbnail_path: null, duration: 360, audio_size: 4096, play_count: 0 },
    ],
    '艺术文化': [
      { id: 'art-1', title: 'Mona Lisa', category: '艺术文化', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 420, audio_size: 5120, play_count: 0 },
      { id: 'art-2', title: 'Van Gogh', category: '艺术文化', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 480, audio_size: 6144, play_count: 0 },
    ],
    '故事': [
      { id: 'story-1', title: 'Cinderella', category: '故事', difficulty: 'A2', audio_path: null, thumbnail_path: null, duration: 600, audio_size: 7168, play_count: 0 },
    ],
    '动画片': [
      { id: 'cartoon-1', title: 'Disney Classics', category: '动画片', difficulty: 'A1', audio_path: null, thumbnail_path: null, duration: 720, audio_size: 8192, play_count: 0 },
    ],
    '人物访谈': [
      { id: 'interview-1', title: 'Steve Jobs Interview', category: '人物访谈', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 1800, audio_size: 20480, play_count: 0 },
    ],
    'BBC Learning English': [
      { id: 'bbc-1', title: '6 Minute English', category: 'BBC Learning English', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 360, audio_size: 4096, play_count: 0 },
      { id: 'bbc-2', title: 'English at Work', category: 'BBC Learning English', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 420, audio_size: 5120, play_count: 0 },
    ],
    'VOA Learning English': [
      { id: 'voa-1', title: 'VOA Slow English', category: 'VOA Learning English', difficulty: 'B1', audio_path: null, thumbnail_path: null, duration: 480, audio_size: 6144, play_count: 0 },
    ],
    'IELTS Listening': [
      { id: 'ielts-1', title: 'IELTS Practice Test 1', category: 'IELTS Listening', difficulty: 'B2', audio_path: null, thumbnail_path: null, duration: 1800, audio_size: 20480, play_count: 0 },
    ],
  },
  categoryCounts: {
    '日常生活': 4,
    'Science and Facts': 2,
    'BBC Earth': 2,
    '历史演讲': 2,
    'TED演讲': 2,
    '文化历史': 2,
    '心灵故事': 1,
    '艺术文化': 2,
    '故事': 1,
    '动画片': 1,
    '人物访谈': 1,
    'BBC Learning English': 2,
    'VOA Learning English': 1,
    'IELTS Listening': 1,
  },
  categories: CATEGORIES
}

export const dynamic = 'force-dynamic'

export async function GET() {
  // 🔥 直接返回硬编码数据，跳过所有数据库查询
  return NextResponse.json(STATIC_DATA, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300', // 5分钟缓存
    },
  })
}

// OPTIONS 方法
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}
