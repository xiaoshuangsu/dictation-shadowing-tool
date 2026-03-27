/**
 * Check if word is in user's vocabulary - API
 *
 * GET /api/user-words/check?word={word}
 * Returns: { success: true, saved: boolean }
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 🔴 防御性修复：强制声明动态渲染，避免 Next.js 构建错误
// 此接口使用了 request.url 获取查询参数，必须在运行时处理
export const dynamic = 'force-dynamic'

const getSupabaseClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  return createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey || ''
  )
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const word = searchParams.get('word')

    if (!word) {
      return NextResponse.json(
        { error: 'Missing word parameter' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    const userId = authHeader?.replace('Bearer ', '')

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseClient()
    const normalizedWord = word.toLowerCase().trim()

    // 检查单词是否已保存
    const { data } = await supabase
      .from('user_words')
      .select('id')
      .eq('user_id', userId)
      .eq('word', normalizedWord)
      .single()

    return NextResponse.json({
      success: true,
      saved: !!data
    })
  } catch (error: any) {
    console.error('[API] Check word error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
