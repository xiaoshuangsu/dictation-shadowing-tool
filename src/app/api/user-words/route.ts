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
 * 🔥 V4.6: Supabase 查询重试包装器
 * 处理网络连接错误（ECONNRESET）和临时性故障
 * @param queryFn - Supabase 查询函数
 * @param maxRetries - 最大重试次数（默认 3）
 * @param delay - 重试延迟（毫秒，默认 1000ms）
 */
async function retrySupabaseQuery<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn()
    } catch (error: any) {
      lastError = error
      const isNetworkError =
        error.message?.includes('fetch failed') ||
        error.message?.includes('ECONNRESET') ||
        error.code === 'ECONNRESET'

      if (isNetworkError && attempt < maxRetries) {
        console.warn(`[API] 🔄 网络错误，第 ${attempt} 次重试... (${delay}ms 延迟)`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2 // 指数退避
      } else {
        throw error
      }
    }
  }

  throw lastError
}

/**
 * 语言代码映射：将前端语言代码映射到数据库字段键
 * 用于从 definitions 字段（旧格式）提取翻译
 */
function getLanguageKey(lang: string): string {
  const langMap: Record<string, string> = {
    'zh': 'zh-CN',
    'zh_hant': 'zh-Hant',
    'vi': 'vi',
    'ja': 'ja',
    'de': 'de',
    'es': 'es',
    'fr': 'fr',
    'ko': 'ko',
    'pt': 'pt',
    'ru': 'ru',
    'ar': 'ar',
    'th': 'th',
    'id': 'id',
    'ms': 'ms',
    'tr': 'tr',
    'el': 'el',
    'uk': 'uk',
    'bn': 'bn',
    'mn': 'mn',
    'hi': 'hi'
  }
  return langMap[lang] || 'zh-CN'
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
    const targetLanguage = searchParams.get('targetLanguage') || 'zh'

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

    // 第一步：查询 user_words（只选择必要字段，减少流量）
    let query = supabase
      .from('user_words')
      .select('id, user_id, word, phonetic, context_sentence, material_id, material_title, audio_timestamp, audio_url, mastery_status, created_at, updated_at, next_review_at, review_level')
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

    // 第二步：批量查询 dictionary_cache 获取音频 URL、标准例句和翻译（只选择必要字段）
    // 🔥 V30.3.6: 数据瘦身 - 移除 definitions 字段（JSONB，可能很大），只保留 translations
    if (words && words.length > 0) {
      const wordList = words.map(w => w.word)
      const { data: cacheData } = await supabase
        .from('dictionary_cache')
        .select('word, audio_url_us, audio_url_uk, example, translations')  // 🔥 不查询 definitions
        .in('word', wordList)

      // 创建字典缓存映射
      const cacheMap: Record<string, {
        audio_url_us: string | null
        audio_url_uk: string | null
        example: string | null
        definitions: string | null
        translations: Record<string, string> | null
      }> = {}
      if (cacheData) {
        cacheData.forEach(item => {
          cacheMap[item.word] = {
            audio_url_us: item.audio_url_us,
            audio_url_uk: item.audio_url_uk,
            example: item.example,
            definitions: null,  // 🔥 V30.3.6: 不传输 definitions（节省带宽）
            translations: item.translations
          }
        })
      }

      // 第三步：查询 materials 表获取素材信息（用于原句跳转，只选择必要字段）
      // 🔥 V30.3.6: 移除 transcript 查询，改为按需在客户端查询（减少 4MB+ 数据传输）
      const materialIds = words
        .map(w => w.material_id)
        .filter((id): id is string => id != null)

      // 🔍 调试：打印 hurtle 的 material_id
      const hurtleWord = words.find(w => w.word.toLowerCase() === 'hurtle')
      if (hurtleWord) {
        console.log(`[API] 🐛 HURTLE: word="${hurtleWord.word}" | material_id="${hurtleWord.material_id}" | TS=${hurtleWord.audio_timestamp}`)
        console.log(`[API] 🐛 HURTLE: materialIds in query=`, materialIds)
        console.log(`[API] 🐛 HURTLE: hurtle material_id included? ${materialIds.includes(hurtleWord.material_id || '')}`)
      }

      const materialsMap: Record<string, {
        category: string
        slug: string
        transcript: any[] | null  // 保留字段供客户端按需查询
        matched_sentence?: string
        matched_index?: number
      }> = {}

      if (materialIds.length > 0) {
        // 🔥 V30.3.6: 只查询 id, category, slug，不查询 transcript（节省 4MB+ 带宽）
        const { data: materials } = await supabase
          .from('materials')
          .select('id, category, slug')  // 🔥 数据瘦身：移除巨大的 transcript 字段
          .in('id', materialIds)

        if (materials) {
          materials.forEach(material => {
            // 🔥 V30.3.6: 由于不再查询 transcript，直接使用数据库存储的 context_sentence
            let matchedSentence: string | null = null
            let matchedIndex: number | null = null

            // 🔧 简化逻辑：直接使用数据库中存储的 context_sentence
            try {
              const wordWithMaterial = words.find(w => w.material_id === material.id)

              if (wordWithMaterial?.context_sentence) {
                // 直接使用存储的句子（不再需要 transcript 匹配）
                matchedSentence = wordWithMaterial.context_sentence
              }
            } catch (matchingError) {
              // 🔴 容错处理：静默忽略错误
              console.error(`[API] ❌ Error processing material ${material.id}:`, (matchingError as Error).message)
            }

            materialsMap[material.id] = {
              category: material.category,
              slug: material.slug,
              transcript: null,  // 🔥 V30.3.6: 不传输 transcript，节省带宽
              matched_sentence: matchedSentence || undefined,
              matched_index: matchedIndex || undefined
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
          definitions: null,
          translations: null
        }
        const material = word.material_id ? materialsMap[word.material_id] : null

        // 🔥 从 translations 字段提取目标语言的翻译
        // 🔴 优先使用 translations 字段（21 国语言），避免回退到英文
        let matchedTranslation = ''

        if (cache.translations && typeof cache.translations === 'object') {
          // 直接从 translations 对象获取目标语言
          matchedTranslation = cache.translations[targetLanguage] || ''

          // 如果目标语言不存在，尝试常见回退语言（但不是英文）
          if (!matchedTranslation && targetLanguage !== 'zh') {
            matchedTranslation = cache.translations['zh'] || cache.translations['zh_hant'] || ''
          }

          // 最后才回退到英文（作为兜底）
          if (!matchedTranslation) {
            matchedTranslation = cache.translations['en'] || ''
          }
        }

        // 🔧 如果 translations 字段为空，尝试从旧的 definitions 字段获取
        if (!matchedTranslation && cache.definitions && typeof cache.definitions === 'object') {
          const langKey = getLanguageKey(targetLanguage)
          matchedTranslation = cache.definitions[langKey] || cache.definitions['zh-CN'] || cache.definitions['en'] || ''
        }

        // 🔴 调试日志：帮助排查翻译匹配问题
        if (word.word.toLowerCase() === 'hurtle') {
          console.log('[API] 🐛 HURTLE translation:', {
            word: word.word,
            targetLanguage,
            matchedTranslation,
            hasTranslations: !!cache.translations,
            translationsKeys: cache.translations ? Object.keys(cache.translations) : []
          })
        }

        return {
          ...word,
          dictionary_cache: {
            audio_url_us: cache.audio_url_us,
            audio_url_uk: cache.audio_url_uk,
            example: cache.example,
            definitions: cache.definitions,
            translations: cache.translations,
            matched_translation: matchedTranslation
          },
          material_info: material ? {
            ...material,
            transcript: material.transcript // 保留完整 transcript 供前端使用
          } : null
        }
      })

      console.log('[API] Fetched words:', { count: wordsWithAudioAndMaterials.length, total: count })

      // 🔴 紧急修复：移除 GET 请求内的数据库写入逻辑
      // 原因：在 GET 循环内进行数据库 update 会导致线上超时/死锁，引发 500 错误
      // 数据库持久化应交给专门的 PATCH 接口或异步任务处理
      // 此接口现在仅负责"根据包含性检索并返回正确结果"

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

    // 检查是否已存在（只选择必要字段）
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
    const { wordId, masteryStatus, word, definition, phonetic, translations, contextSentence, audioUrl } = body

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
    // 🔥 V3.0 修复：wordId 可以为空，但 word 和 masteryStatus 必须存在
    if (!masteryStatus) {
      return NextResponse.json(
        { error: 'Missing required field: masteryStatus' },
        { status: 400 }
      )
    }

    if (!word) {
      return NextResponse.json(
        { error: 'Missing required field: word' },
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

    console.log('[API] Upserting word mastery:', { userId, wordId, masteryStatus, word })

    // 🔴 使用函数调用获取客户端
    const supabase = getSupabaseClient()

    // 🔥 V4.6: 使用重试包装器查询现有记录（防止 ECONNRESET）
    // 🔥 V30.3.6: 移除不存在的字段 current_streak, last_streak_update
    const { data: existingRecord, error: checkError } = await retrySupabaseQuery(async () => {
      return await supabase
        .from('user_words')
        .select('id, user_id, word, mastery_status, review_level')  // 🔥 只查询存在的字段
        .eq('user_id', userId)
        .eq('word', word?.toLowerCase()?.trim())
        .maybeSingle()
    })

    let data, error

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = 未找到记录，这是预期的
      console.error('[API] Check error:', checkError)
      return NextResponse.json(
        { error: 'Failed to check word', details: checkError.message },
        { status: 500 }
      )
    }

    if (existingRecord) {
      // 🔥 记录存在，更新它
      console.log('[API] 📝 记录已存在，更新...')

      // 🔴 根据掌握状态设置复习级别和下次复习时间
      let nextReviewAt = new Date()
      let reviewLevel = 0

      if (masteryStatus === 'mastered') {
        reviewLevel = 5
        nextReviewAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      } else if (masteryStatus === 'learning') {
        reviewLevel = 0
        nextReviewAt = new Date(Date.now() + 1 * 60 * 60 * 1000)
      } else if (masteryStatus === 'familiar') {
        reviewLevel = 3
        nextReviewAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      }

      // 🔥 V4.6: 使用重试包装器执行更新操作（防止 ECONNRESET）
      const updateResult = await retrySupabaseQuery(async () => {
        return await supabase
          .from('user_words')
          .update({
            mastery_status: masteryStatus,
            review_level: reviewLevel,
            next_review_at: nextReviewAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id)
          .eq('user_id', userId)
          .select()
          .single()
      })

      data = updateResult.data
      error = updateResult.error

      // 🔥 V4.5: 幂等性检查 - 如果状态相同，视为成功（避免重复更新的错误）
      if (error && existingRecord.mastery_status === masteryStatus) {
        console.log('[API] ✅ 幂等性保护：状态已相同，忽略重复更新', {
          word: existingRecord.word,
          currentStatus: existingRecord.mastery_status,
          requestedStatus: masteryStatus
        })
        // 返回现有记录，视为成功
        data = existingRecord
        error = null
      }
    } else {
      // 🔥 记录不存在，创建新记录（"练即入库"）
      console.log('[API] ➕ 记录不存在，创建新记录...')

      // 如果没有提供单词信息，返回错误
      if (!word) {
        return NextResponse.json(
          { error: 'Missing word for new record' },
          { status: 400 }
        )
      }

      // 设置初始复习时间（立即到期）
      const nextReviewAt = new Date()

      // 🔥 V4.6: 使用重试包装器执行插入操作（防止 ECONNRESET）
      // 🔥 V30.3.6: 补全必填字段（参考 POST 方法），修复 NOT NULL 约束错误
      const insertResult = await retrySupabaseQuery(async () => {
        return await supabase
          .from('user_words')
          .insert({
            user_id: userId,
            word: word?.toLowerCase()?.trim(),
            phonetic: phonetic || null,
            definition: definition || null,
            context_sentence: contextSentence || null,
            material_id: null,  // PATCH 请求通常不包含 material_id
            material_title: null,
            audio_timestamp: null,
            audio_url: audioUrl || null,
            mastery_status: masteryStatus,
            review_level: 0,
            next_review_at: nextReviewAt.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
      })

      data = insertResult.data
      error = insertResult.error
    }

    if (error) {
      console.error('[API] Upsert error:', error)
      return NextResponse.json(
        { error: 'Failed to upsert word', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to upsert word - no data returned' },
        { status: 500 }
      )
    }

    console.log('[API] ✅ Upserted word mastery:', {
      id: wordId,
      word: data.word,
      action: existingRecord ? 'updated' : 'created',
      status: masteryStatus,
      updated_at: data.updated_at,
      created_at: data.created_at,
      updated_at_is_new: new Date(data.updated_at) > new Date(Date.now() - 10000)
    })

    // 🔥 V4.5: 更新 Streak（如果达成每日目标）
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      // 🔥 V4.6: 使用重试包装器查询今日复习记录（防止 ECONNRESET）
      const { data: todayReviews, error: countError } = await retrySupabaseQuery(async () => {
        return await supabase
          .from('user_words')
          .select('created_at, updated_at')
          .eq('user_id', userId)
      })

      if (!countError && todayReviews) {
        const reviewedToday = todayReviews.filter((w: any) => {
          const updatedAt = new Date(w.updated_at)
          const createdAt = new Date(w.created_at)

          // 今天更新过且非今天创建，或今天创建且更新时间晚于创建时间
          return (updatedAt >= todayStart && createdAt < todayStart) ||
                 (createdAt >= todayStart && updatedAt > createdAt)
        }).length

        const DAILY_GOAL = 20
        const goalAchieved = reviewedToday >= DAILY_GOAL

        console.log('[API] 📊 今日统计:', {
          userId: userId.substring(0, 8) + '...',
          reviewedToday,
          goalAchieved,
          dailyGoal: DAILY_GOAL
        })

        // 如果达成目标，更新 Streak
        if (goalAchieved) {
          // 🔥 V4.6: 使用重试包装器查询用户 profile（防止 ECONNRESET）
          const { data: profile } = await retrySupabaseQuery(async () => {
            return await supabase
              .from('user_profiles')
              .select('current_streak, last_streak_update')
              .eq('id', userId)
              .single()
          })

          if (profile) {
            const lastUpdate = profile.last_streak_update ? new Date(profile.last_streak_update) : null
            const alreadyUpdatedToday = lastUpdate && lastUpdate >= todayStart

            if (!alreadyUpdatedToday) {
              // 今天未更新过，Streak +1
              const newStreak = (profile.current_streak || 0) + 1

              // 🔥 V4.6: 使用重试包装器更新 Streak（防止 ECONNRESET）
              await retrySupabaseQuery(async () => {
                return await supabase
                  .from('user_profiles')
                  .update({
                    current_streak: newStreak,
                    last_streak_update: now.toISOString()
                  })
                  .eq('id', userId)
              })

              console.log('[API] 🔥 Streak 更新:', {
                oldStreak: profile.current_streak || 0,
                newStreak,
                userId: userId.substring(0, 8) + '...'
              })
            } else {
              console.log('[API] ✅ Streak 今日已更新，跳过')
            }
          }
        }
      }
    } catch (streakError) {
      // Streak 更新失败不影响主流程
      console.error('[API] ⚠️ Streak 更新失败（非致命）:', streakError)
    }

    return NextResponse.json({
      success: true,
      message: existingRecord ? 'Word updated successfully' : 'Word added successfully',
      word: data,
      isNew: !existingRecord  // 🔥 标识是否为新创建的记录
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

    // 🔴 使用函数调用获取客户端
    const supabase = getSupabaseClient()

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
