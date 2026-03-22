/**
 * User Words API - 生词本增删改查接口
 *
 * 支持的操作：
 * - GET: 获取用户的所有生词（可按掌握状态筛选）
 * - POST: 添加生词（如果已存在则更新）
 * - PATCH: 更新生词的掌握状态
 * - DELETE: 删除生词
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 🔴 容错初始化：只在运行时创建客户端，避免构建时错误
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
 * GET /api/user-words
 * 获取用户的所有生词（可按掌握状态筛选）
 *
 * Query params:
 * - status: 掌握状态筛选（learning/familiar/mastered）
 * - limit: 返回数量限制（默认 100）
 * - offset: 分页偏移量
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 从请求头获取用户 ID（由前端通过 Authorization 传递）
    // 注意：实际生产环境应该验证 JWT token
    const authHeader = request.headers.get('authorization')
    const userId = authHeader?.replace('Bearer ', '')

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing user ID' },
        { status: 401 }
      )
    }

    console.log('[API] Fetching user words:', { userId, status, limit, offset })

    // 🔴 使用函数调用获取客户端
    const supabase = getSupabaseClient()

    // 构建查询
    let query = supabase
      .from('user_words')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 按掌握状态筛选
    if (status && ['learning', 'familiar', 'mastered'].includes(status)) {
      query = query.eq('mastery_status', status)
    }

    // 分页
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[API] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user words', details: error.message },
        { status: 500 }
      )
    }

    console.log('[API] Fetched words:', { count: data?.length || 0, total: count })

    return NextResponse.json({
      success: true,
      words: data || [],
      total: count || 0,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user-words
 * 添加生词（如果已存在则更新掌握状态为 learning）
 *
 * Body:
 * - userId: 用户 ID
 * - word: 单词（小写）
 * - phonetic: 音标（可选）
 * - definition: 释义（JSON 格式）
 * - contextSentence: 例句（可选）
 * - materialId: 关联素材 ID（可选）
 * - materialTitle: 素材标题（可选）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userId,
      word,
      phonetic,
      definition,
      contextSentence,
      materialId,
      materialTitle
    } = body

    // 验证必填字段
    if (!userId || !word || !definition) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, word, definition' },
        { status: 400 }
      )
    }

    // 标准化单词（小写）
    const normalizedWord = word.toLowerCase().trim()

    console.log('[API] Adding word:', { userId, word: normalizedWord, materialId })

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('user_words')
      .select('id, mastery_status')
      .eq('user_id', userId)
      .eq('word', normalizedWord)
      .single()

    if (existing) {
      // 如果已存在，更新掌握状态为 learning（重新学习）
      const { data: updated, error } = await supabase
        .from('user_words')
        .update({
          mastery_status: 'learning',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[API] Update error:', error)
        return NextResponse.json(
          { error: 'Failed to update existing word', details: error.message },
          { status: 500 }
        )
      }

      console.log('[API] Updated existing word:', { id: existing.id })
      return NextResponse.json({
        success: true,
        message: 'Word already exists, reset to learning',
        word: updated,
        isNew: false
      })
    }

    // 插入新单词
    const { data, error } = await supabase
      .from('user_words')
      .insert({
        user_id: userId,
        word: normalizedWord,
        phonetic: phonetic || null,
        definition,
        context_sentence: contextSentence || null,
        material_id: materialId || null,
        material_title: materialTitle || null,
        mastery_status: 'learning'
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to add word', details: error.message },
        { status: 500 }
      )
    }

    console.log('[API] Added new word:', { id: data.id })
    return NextResponse.json({
      success: true,
      message: 'Word added successfully',
      word: data,
      isNew: true
    })
  } catch (error: any) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user-words
 * 更新生词的掌握状态
 *
 * Body:
 * - userId: 用户 ID
 * - wordId: 生词记录 ID
 * - masteryStatus: 新的掌握状态
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { userId, wordId, masteryStatus } = body

    // 验证必填字段
    if (!userId || !wordId || !masteryStatus) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, wordId, masteryStatus' },
        { status: 400 }
      )
    }

    // 验证掌握状态值
    if (!['learning', 'familiar', 'mastered'].includes(masteryStatus)) {
      return NextResponse.json(
        { error: 'Invalid mastery status. Must be: learning, familiar, or mastered' },
        { status: 400 }
      )
    }

    console.log('[API] Updating word mastery:', { userId, wordId, masteryStatus })

    const { data, error } = await supabase
      .from('user_words')
      .update({
        mastery_status: masteryStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', wordId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[API] Update error:', error)
      return NextResponse.json(
        { error: 'Failed to update word', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Word not found or unauthorized' },
        { status: 404 }
      )
    }

    console.log('[API] Updated word mastery:', { id: wordId, status: masteryStatus })
    return NextResponse.json({
      success: true,
      message: 'Word updated successfully',
      word: data
    })
  } catch (error: any) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user-words
 * 删除生词
 *
 * Body:
 * - userId: 用户 ID
 * - wordId: 生词记录 ID
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { userId, wordId } = body

    // 验证必填字段
    if (!userId || !wordId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, wordId' },
        { status: 400 }
      )
    }

    console.log('[API] Deleting word:', { userId, wordId })

    const { error } = await supabase
      .from('user_words')
      .delete()
      .eq('id', wordId)
      .eq('user_id', userId)

    if (error) {
      console.error('[API] Delete error:', error)
      return NextResponse.json(
        { error: 'Failed to delete word', details: error.message },
        { status: 500 }
      )
    }

    console.log('[API] Deleted word:', { id: wordId })
    return NextResponse.json({
      success: true,
      message: 'Word deleted successfully'
    })
  } catch (error: any) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
