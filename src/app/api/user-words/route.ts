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

// 🔴 防御性修复：强制声明动态渲染，避免 Next.js 构建错误
// 此接口使用了 request.url 获取查询参数，必须在运行时处理
export const dynamic = 'force-dynamic'

/**
 * 从 dictionaryapi.dev 获取音频 URL
 * @param word - 单词
 * @returns 音频 URL 对象 {us: string | null, uk: string | null}
 */
async function fetchAudioUrlsFromDictAPI(word: string): Promise<{us: string | null, uk: string | null}> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, {
      signal: AbortSignal.timeout(10000) // 10 秒超时
    })

    if (!response.ok) {
      return { us: null, uk: null }
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return { us: null, uk: null }
    }

    const phonetics = data[0]?.phonetics || []
    const audioUrls = { us: null as string | null, uk: null as string | null }

    for (const phonetic of phonetics) {
      const audioUrl = phonetic.audio
      if (!audioUrl || !audioUrl.endsWith('.mp3')) continue

      if (audioUrl.includes('-us') && !audioUrls.us) {
        audioUrls.us = audioUrl
      } else if (audioUrl.includes('-uk') && !audioUrls.uk) {
        audioUrls.uk = audioUrl
      } else if (!audioUrls.us) {
        audioUrls.us = audioUrl
      }
    }

    return audioUrls
  } catch (error) {
    console.warn('[API] Failed to fetch audio URLs:', { word, error: (error as Error).message })
    return { us: null, uk: null }
  }
}

/**
 * 在后台异步获取音频 URL 并更新到 dictionary_cache
 * @param word - 单词
 * @param supabase - Supabase 客户端
 */
async function fetchAudioUrlsInBackground(word: string, supabase: any): Promise<void> {
  try {
    // 检查是否已有音频 URL
    const { data: existing } = await supabase
      .from('dictionary_cache')
      .select('audio_url_us, audio_url_uk')
      .eq('word', word)
      .single()

    // 如果已有音频，跳过
    if ((existing?.audio_url_us && existing.audio_url_us.includes('dictionaryapi.dev')) ||
        (existing?.audio_url_uk && existing.audio_url_uk.includes('dictionaryapi.dev'))) {
      console.log('[API] Audio URLs already exist for word:', word)
      return
    }

    // 获取音频 URL
    const audioUrls = await fetchAudioUrlsFromDictAPI(word)

    // 更新 dictionary_cache
    if (audioUrls.us || audioUrls.uk) {
      const updateData: any = {}
      if (audioUrls.us) updateData.audio_url_us = audioUrls.us
      if (audioUrls.uk) updateData.audio_url_uk = audioUrls.uk

      await supabase
        .from('dictionary_cache')
        .update(updateData)
        .eq('word', word)

      console.log('[API] ✅ Updated audio URLs for word:', word, {
        us: audioUrls.us ? 'found' : 'not found',
        uk: audioUrls.uk ? 'found' : 'not found'
      })
    }
  } catch (error) {
    // 静默失败，不影响主流程
    console.warn('[API] Background audio fetch failed:', { word, error: (error as Error).message })
  }
}

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

    // 第一步：查询 user_words
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

    const { data: words, error, count } = await query

    if (error) {
      console.error('[API] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user words', details: error.message },
        { status: 500 }
      )
    }

    // 第二步：批量查询 dictionary_cache 获取音频 URL 和标准例句
    if (words && words.length > 0) {
      const wordList = words.map(w => w.word)
      const { data: cacheData } = await supabase
        .from('dictionary_cache')
        .select('word, audio_url_us, audio_url_uk, example, definitions')
        .in('word', wordList)

      // 创建字典缓存映射
      const cacheMap: Record<string, {
        audio_url_us: string | null
        audio_url_uk: string | null
        example: string | null
        definitions: string | null
      }> = {}
      if (cacheData) {
        cacheData.forEach(item => {
          cacheMap[item.word] = {
            audio_url_us: item.audio_url_us,
            audio_url_uk: item.audio_url_uk,
            example: item.example,
            definitions: item.definitions
          }
        })
      }

      // 第三步：查询 materials 表获取素材信息（用于原句跳转）
      const materialIds = words
        .map(w => w.material_id)
        .filter((id): id is string => id != null)

      const materialsMap: Record<string, {
        category: string
        slug: string
        transcript: any[] | null
      }> = {}

      if (materialIds.length > 0) {
        const { data: materials } = await supabase
          .from('materials')
          .select('id, category, slug, transcript')
          .in('id', materialIds)

        if (materials) {
          materials.forEach(material => {
            materialsMap[material.id] = {
              category: material.category,
              slug: material.slug,
              transcript: material.transcript
            }
          })
        }
      }

      // 合并数据
      const wordsWithAudioAndMaterials = words.map(word => {
        const cache = cacheMap[word.word] || {
          audio_url_us: null,
          audio_url_uk: null,
          example: null,
          definitions: null
        }
        const material = word.material_id ? materialsMap[word.material_id] : null

        return {
          ...word,
          dictionary_cache: {
            audio_url_us: cache.audio_url_us,
            audio_url_uk: cache.audio_url_uk,
            example: cache.example,
            definitions: cache.definitions
          },
          material_info: material
        }
      })

      console.log('[API] Fetched words:', { count: wordsWithAudioAndMaterials.length, total: count })

      return NextResponse.json({
        success: true,
        words: wordsWithAudioAndMaterials,
        total: count || 0,
        limit,
        offset
      })
    }

    console.log('[API] Fetched words:', { count: 0, total: count })

    return NextResponse.json({
      success: true,
      words: [],
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
 * - audioTimestamp: 音频时间戳（可选）
 * - audioUrl: 音频 URL（可选）
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
      materialTitle,
      audioTimestamp,
      audioUrl
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

    console.log('[API] Adding word:', { userId, word: normalizedWord, materialId, audioTimestamp })

    // 🔴 使用函数调用获取客户端
    const supabase = getSupabaseClient()

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
        audio_timestamp: audioTimestamp ? parseFloat(audioTimestamp) : null,
        audio_url: audioUrl || null,
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

    // 🔴 新增：异步获取音频 URL（按需更新）
    // 不阻塞响应，在后台静默获取音频
    fetchAudioUrlsInBackground(normalizedWord, supabase)

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
 * - wordId: 生词记录 ID
 * - masteryStatus: 新的掌握状态
 *
 * Header:
 * - Authorization: Bearer <userId>
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { wordId, masteryStatus } = body

    // 🔴 从 Authorization header 获取 userId
    const authHeader = request.headers.get('authorization')
    const userId = authHeader?.replace('Bearer ', '')

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing user ID' },
        { status: 401 }
      )
    }

    // 验证必填字段
    if (!wordId || !masteryStatus) {
      return NextResponse.json(
        { error: 'Missing required fields: wordId, masteryStatus' },
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

    // 🔴 使用函数调用获取客户端
    const supabase = getSupabaseClient()

    // 🔴 根据掌握状态设置复习级别和下次复习时间
    let nextReviewAt = new Date()
    let reviewLevel = 0

    if (masteryStatus === 'mastered') {
      // 已掌握：设置较高的复习级别，下次复习时间设为 7 天后
      reviewLevel = 5
      nextReviewAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 天后
    } else if (masteryStatus === 'learning') {
      // 学习中：重置复习级别，下次复习时间设为 1 小时后
      reviewLevel = 0
      nextReviewAt = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 小时后
    } else if (masteryStatus === 'familiar') {
      // 熟悉：设置中等复习级别，下次复习时间设为 1 天后
      reviewLevel = 3
      nextReviewAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 天后
    }

    const { data, error } = await supabase
      .from('user_words')
      .update({
        mastery_status: masteryStatus,
        review_level: reviewLevel,
        next_review_at: nextReviewAt.toISOString(),
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

    console.log('[API] ✅ Updated word mastery:', {
      id: wordId,
      status: masteryStatus,
      reviewLevel,
      nextReviewAt
    })

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
