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

    // 第二步：批量查询 dictionary_cache 获取音频 URL、标准例句和翻译
    if (words && words.length > 0) {
      const wordList = words.map(w => w.word)
      const { data: cacheData } = await supabase
        .from('dictionary_cache')
        .select('word, audio_url_us, audio_url_uk, example, definitions, translations')
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
            definitions: item.definitions,
            translations: item.translations
          }
        })
      }

      // 第三步：查询 materials 表获取素材信息（用于原句跳转）
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
        transcript: any[] | null
        matched_sentence?: string
        matched_index?: number
      }> = {}

      if (materialIds.length > 0) {
        const { data: materials } = await supabase
          .from('materials')
          .select('id, category, slug, transcript')
          .in('id', materialIds)

        if (materials) {
          materials.forEach(material => {
            const transcript = material.transcript || []
            let matchedSentence: string | null = null
            let matchedIndex: number | null = null

            // 🔧 三步走强制校验逻辑：修复原句偏移 Bug
            // 🔴 容错保护：用 try-catch 包裹匹配逻辑，防止单词匹配失败导致整个 API 崩溃
            try {
              const wordWithMaterial = words.find(w => w.material_id === material.id)

              // 🔍 调试：检查是否找到了单词
              if (wordWithMaterial?.word?.toLowerCase() === 'hurtle') {
                console.log(`[API] 🐛 HURTLE FOUND: material_id=${wordWithMaterial.material_id} | TS=${wordWithMaterial.audio_timestamp} | context_sentence="${wordWithMaterial.context_sentence?.substring(0, 50)}..."`)
              }

              if (wordWithMaterial?.audio_timestamp !== null && wordWithMaterial?.audio_timestamp !== undefined) {
                const timestamp = wordWithMaterial.audio_timestamp
                const targetWord = wordWithMaterial.word.toLowerCase()

                // 🔥 优先使用数据库中已存储的正确 context_sentence（如果包含单词）
                const storedSentence = wordWithMaterial.context_sentence
                const storedContainsWord = storedSentence && storedSentence.toLowerCase().includes(targetWord)

                // 🔍 调试：检查 hurtle 的存储句子
                if (targetWord === 'hurtle') {
                  console.log(`[API] 🐛 HURTLE CHECK: storedSentence=${storedSentence ? `"${storedSentence.substring(0, 30)}..."` : 'null'} | containsWord=${storedContainsWord}`)
                }

                // 🔍 调试日志：hurtle 特殊处理
                if (targetWord === 'hurtle') {
                  console.log(`[API] 🐛 HURTLE DEBUG: storedSentence="${storedSentence?.substring(0, 50)}..." | containsWord=${storedContainsWord}`)
                }

                if (storedContainsWord) {
                  matchedSentence = storedSentence
                  console.log(`[API] ✅ USING STORED: '${targetWord}' | TS: ${timestamp} | Sentence: "${storedSentence.substring(0, 50)}..."`)
                } else {
                  // 数据库中没有或句子不包含单词，触发重新匹配
                  console.log(`[API] 🔍 Checking candidates for '${targetWord}' at [${timestamp}s]...`)

                  // 🔍 第一步：范围查询与初步匹配（1秒范围）
                  const searchRange = 1.0 // 1秒范围
                  const candidates: Array<{ index: number; sentence: any; start: number; end: number; distance: number }> = []

                  for (let i = 0; i < transcript.length; i++) {
                    const sentence = transcript[i]
                    if (!sentence || !sentence.text) continue

                    const start = sentence.start_time || sentence.startTime || 0
                    const end = sentence.end_time || sentence.endTime || start

                    // 检查 timestamp 是否在句子时间范围附近（前后1秒）
                    if (timestamp >= start - searchRange && timestamp <= end + searchRange) {
                      candidates.push({
                        index: i,
                        sentence,
                        start,
                        end,
                        distance: Math.abs((start + end) / 2 - timestamp) // 距离中心点的距离
                      })
                    }
                  }

                  // 🔍 第二步：内容确定性校验（Key Fix）
                  // 遍历候选句子，找到真正包含单词的句子
                  let correctMatch: { index: number; sentence: any } | null = null

                  // 按距离排序，优先匹配时间最接近的句子
                  candidates.sort((a, b) => a.distance - b.distance)

                  console.log(`[API] 📊 Found ${candidates.length} candidates in 1s range`)

                  for (const candidate of candidates) {
                    const sentenceText = candidate.sentence.text.toLowerCase()
                    const containsWord = sentenceText.includes(targetWord)
                    const preview = candidate.sentence.text.substring(0, 50)

                    console.log(`[API] 🔎 Candidate Found: "${preview}..." | Match: ${containsWord ? '✅ True' : '❌ False'}`)

                    if (containsWord) {
                      correctMatch = { index: candidate.index, sentence: candidate.sentence }
                      console.log(`[API] ✅ MATCHED: '${targetWord}' found in candidate at index ${candidate.index}`)
                      break
                    }
                  }

                  // 🔍 第三步：兜底与扩大搜索（3秒范围）
                  if (!correctMatch) {
                    console.log(`[API] ⚠️  No match in 1s range, expanding to 3s...`)

                    const expandedCandidates: Array<{ index: number; sentence: any; start: number; end: number; distance: number }> = []

                    for (let i = 0; i < transcript.length; i++) {
                      const sentence = transcript[i]
                      if (!sentence || !sentence.text) continue

                      const start = sentence.start_time || sentence.startTime || 0
                      const end = sentence.end_time || sentence.endTime || start

                      // 扩大到前后3秒
                      if (timestamp >= start - 3.0 && timestamp <= end + 3.0) {
                        expandedCandidates.push({
                          index: i,
                          sentence,
                          start,
                          end,
                          distance: Math.abs((start + end) / 2 - timestamp)
                        })
                      }
                    }

                    expandedCandidates.sort((a, b) => a.distance - b.distance)

                    for (const candidate of expandedCandidates) {
                      const sentenceText = candidate.sentence.text.toLowerCase()
                      const containsWord = sentenceText.includes(targetWord)
                      const preview = candidate.sentence.text.substring(0, 50)

                      console.log(`[API] 🔎 (3s) Candidate: "${preview}..." | Match: ${containsWord ? '✅ True' : '❌ False'}`)

                      if (containsWord) {
                        correctMatch = { index: candidate.index, sentence: candidate.sentence }
                        console.log(`[API] ✅ MATCHED (3s): '${targetWord}' found at index ${candidate.index}`)
                        break
                      }
                    }
                  }

                  // 🔍 第四步：兜底返回原始 context_sentence
                  if (!correctMatch) {
                    console.log(`[API] ⚠️  No match found, using stored context_sentence as fallback`)
                  } else {
                    matchedSentence = correctMatch.sentence.text
                    matchedIndex = correctMatch.index
                  }
                }
              }
            } catch (matchingError) {
              // 🔴 容错处理：如果匹配失败，使用数据库中已存储的 context_sentence
              const wordWithMaterial = words.find(w => w.material_id === material.id)
              const fallbackSentence = wordWithMaterial?.context_sentence || null
              console.error(`[API] ❌ Matching error for material ${material.id}:`, (matchingError as Error).message)
              console.log(`[API] 🔄 Using fallback: stored context_sentence = "${fallbackSentence?.substring(0, 50)}..."`)
              matchedSentence = fallbackSentence
            }

            materialsMap[material.id] = {
              category: material.category,
              slug: material.slug,
              transcript: transcript,
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

    // 🔥 V3.0 修复：优先使用单词名称检查（支持从不同词库练习）
    // 因为 Oxford/IELTS 的 ID 来自 vocabulary_words 表，不能直接用于 user_words 表
    const { data: existingRecord, error: checkError } = await supabase
      .from('user_words')
      .select('*')
      .eq('user_id', userId)
      .eq('word', word?.toLowerCase()?.trim())
      .maybeSingle()

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

      // 🔥 V4.5: 幂等性保护 - 使用 existingRecord.id 而不是 wordId
      // 防止 wordId 不匹配导致更新失败
      const updateResult = await supabase
        .from('user_words')
        .update({
          mastery_status: masteryStatus,
          review_level: reviewLevel,
          next_review_at: nextReviewAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id)  // 🔥 V4.5: 使用记录的实际 ID
        .eq('user_id', userId)
        .select()
        .single()

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

      // 🔥 V3.0 简化插入逻辑：只保留确认存在的字段
      const insertResult = await supabase
        .from('user_words')
        .insert({
          user_id: userId,
          word: word?.toLowerCase()?.trim(),
          mastery_status: masteryStatus,
          review_level: 0,
          next_review_at: nextReviewAt.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

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

      // 统计今天复习过的单词数
      const { data: todayReviews, error: countError } = await supabase
        .from('user_words')
        .select('created_at, updated_at')
        .eq('user_id', userId)

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
          // 获取当前 Streak 和最后更新日期
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('current_streak, last_streak_update')
            .eq('id', userId)
            .single()

          if (profile) {
            const lastUpdate = profile.last_streak_update ? new Date(profile.last_streak_update) : null
            const alreadyUpdatedToday = lastUpdate && lastUpdate >= todayStart

            if (!alreadyUpdatedToday) {
              // 今天未更新过，Streak +1
              const newStreak = (profile.current_streak || 0) + 1

              await supabase
                .from('user_profiles')
                .update({
                  current_streak: newStreak,
                  last_streak_update: now.toISOString()
                })
                .eq('id', userId)

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
