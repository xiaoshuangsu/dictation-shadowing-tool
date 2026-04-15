/**
 * API Route: Topics 素材列表（恢复数据库连接版本）
 *
 * ✅ Supabase 宽限期已生效，恢复数据库查询
 * 🔥 优化：使用精简字段查询，减少 Egress 流量
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

/**
 * 获取 Supabase 客户端
 */
const getSupabaseClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) {
    console.warn('[API] ⚠️  SUPABASE_SERVICE_ROLE_KEY not set')
  }

  return createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey || ''
  )
}

/**
 * GET /api/topics
 * 获取所有分类的素材列表（每个分类最多 4 个）
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient()

    const result: Record<string, any[]> = {}
    const counts: Record<string, number> = {}

    // 并行获取所有分类的素材（每个分类最多4个）和总数
    const promises = CATEGORIES.map(async (category) => {
      // 🔥 优化：只查询必要字段，减少 Egress 流量
      const { data, error } = await supabase
        .from('materials')
        .select('id, title, category, difficulty, audio_path, thumbnail_path, audio_size, duration, play_count, slug')
        .eq('category', category.id)
        .order('title')
        .limit(4)

      if (!error && data) {
        result[category.id] = data
      }

      // 获取该分类的总数
      const { count } = await supabase
        .from('materials')
        .select('*', { count: 'exact', head: true })
        .eq('category', category.id)

      if (count !== null) {
        counts[category.id] = count
      }
    })

    await Promise.all(promises)

    const responseData = {
      materialsByCategory: result,
      categoryCounts: counts,
      categories: CATEGORIES
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // 5分钟缓存
      },
    })
  } catch (error: any) {
    console.error('[API] Error fetching topics:', error)

    // 🔥 优雅降级：如果数据库查询失败，返回空数据而不是错误
    return NextResponse.json({
      materialsByCategory: {},
      categoryCounts: {},
      categories: CATEGORIES,
      error: 'Database query failed, using fallback'
    }, {
      status: 200, // 返回 200 而不是 500，避免前端崩溃
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60', // 失败时减少缓存时间
      },
    })
  }
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
