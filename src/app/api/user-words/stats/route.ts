/**
 * User Words Stats API
 * 获取用户生词统计信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    // 获取用户 ID（从 Authorization header）
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authHeader.replace('Bearer ', '')

    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取用户的所有生词
    const { data: userWords, error } = await supabase
      .from('user_words')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user words:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 })
    }

    // 计算统计数据
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const dueWords = userWords?.filter((w: any) => {
      if (w.mastery_status !== 'learning') return false
      if (!w.next_review_at) return true
      return new Date(w.next_review_at) <= now
    }).length || 0

    // Mock 数据：今日已复习、准确率、连续天数
    // TODO: 从 practice_records 表计算真实数据
    const stats = {
      dueWords,
      reviewed: Math.floor(Math.random() * 20),
      accuracy: 75 + Math.floor(Math.random() * 20),
      streak: 3 + Math.floor(Math.random() * 14)
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error in stats API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
