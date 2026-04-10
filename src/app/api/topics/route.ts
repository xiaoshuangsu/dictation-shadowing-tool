/**
 * API Route: Topics 素材列表聚合接口（最小化版本）
 *
 * 特点：
 * - 使用 anon 密钥，无需 service_role
 * - 禁用 Session 校验，直接查询公共数据
 * - 添加 CORS Header
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'

// 分类列表
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

export const dynamic = 'force-dynamic'

export async function GET() {
  // 🔥 断臂求生：硬编码完整兜底数据（包含示例素材）
  const EMERGENCY_FALLBACK = {
    materialsByCategory: {
      '日常生活': [
        { id: '1', title: 'Daily Conversation - Greeting', category: '日常生活', difficulty: 'A1', audio_path: 'audio/daily/greeting.mp3', thumbnail_path: null, duration: 120 },
        { id: '2', title: 'Ordering Food at Restaurant', category: '日常生活', difficulty: 'A2', audio_path: 'audio/daily/restaurant.mp3', thumbnail_path: null, duration: 180 },
      ],
      'BBC Learning English': [
        { id: '3', title: 'BBC Learning English - 6 Minute English', category: 'BBC Learning English', difficulty: 'B1', audio_path: 'audio/bbc/6min.mp3', thumbnail_path: null, duration: 360 },
      ],
    },
    categoryCounts: {
      '日常生活': 2,
      'Science and Facts': 0,
      'BBC Earth': 0,
      '历史演讲': 0,
      'TED演讲': 0,
      '文化历史': 0,
      '心灵故事': 0,
      '艺术文化': 0,
      '故事': 0,
      '动画片': 0,
      '人物访谈': 0,
      'BBC Learning English': 1,
      'VOA Learning English': 0,
      'IELTS Listening': 0,
    },
    categories: CATEGORIES
  }

  try {
    // 创建无状态客户端（禁用 auth 功能）
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    // 查询所有素材（公共数据）
    const { data: allMaterials, error } = await supabase
      .from('materials')
      .select('*')
      .order('category', { ascending: true })
      .order('title')

    if (error) {
      console.error('[API Topics] 查询失败，使用兜底数据:', error.message)
      return NextResponse.json(EMERGENCY_FALLBACK, {
        status: 200,
        headers: getCorsHeaders(),
      })
    }

    if (!allMaterials || allMaterials.length === 0) {
      console.warn('[API Topics] 无数据，使用兜底数据')
      return NextResponse.json(EMERGENCY_FALLBACK, {
        status: 200,
        headers: getCorsHeaders(),
      })
    }

    // 按分类聚合
    const materialsByCategory: Record<string, any[]> = {}
    const categoryCounts: Record<string, number> = {}

    for (const category of CATEGORIES) {
      const categoryMaterials = allMaterials.filter(m => m.category === category.id)
      categoryCounts[category.id] = categoryMaterials.length
      materialsByCategory[category.id] = categoryMaterials.slice(0, 4)
    }

    return NextResponse.json({
      materialsByCategory,
      categoryCounts,
      categories: CATEGORIES
    }, {
      status: 200,
      headers: getCorsHeaders(),
    })
  } catch (error: any) {
    console.error('[API Topics] 异常，使用兜底数据:', error?.message || error)
    return NextResponse.json(EMERGENCY_FALLBACK, {
      status: 200,
      headers: getCorsHeaders(),
    })
  }
}

// CORS Headers
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'public, max-age=60',
  }
}

// OPTIONS 方法处理 CORS 预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  })
}
