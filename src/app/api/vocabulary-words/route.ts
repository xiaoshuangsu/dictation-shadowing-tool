/**
 * Vocabulary Words API - 从数据库动态查询词汇（V4）
 *
 * 支持的操作：
 * - GET: 根据 category 参数从数据库查询单词列表
 *
 * V4 - 数据库动态查询版本
 * - 根据传入的 category 参数查询数据库
 * - 支持 oxford-3000 和 ielts 分类
 * - 使用分页和并行查询优化
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 强制声明动态渲染
export const dynamic = 'force-dynamic'

/**
 * 获取 Supabase 客户端
 */
const getSupabaseClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  }

  return createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey
  )
}

/**
 * 分批并行查询 Supabase（性能优化版）
 * @param words - 要查询的单词列表
 * @param chunkSize - 每批大小（默认 20，降低并发压力）
 */
async function fetchWordsInChunks(
  supabase: any,
  words: string[],
  chunkSize: number = 20
): Promise<any[]> {
  // 🔥 性能优化：并行查询所有批次
  const chunks: string[][] = []
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize))
  }

  console.log(`[API] 🚀 Parallel fetching ${chunks.length} chunks (${words.length} words total)`)

  // 并行查询所有批次
  const chunkPromises = chunks.map(async (chunk, index) => {
    console.log(`[API] 📦 Starting chunk ${index + 1}/${chunks.length} (${chunk.length} words)`)

    try {
      const { data, error } = await supabase
        .from('dictionary_cache')
        .select('word, phonetic, definitions, translations, example, audio_r2_url, audio_url_us, audio_url_uk')
        .in('word', chunk)
        .order('word', { ascending: true })

      if (error) {
        console.error(`[API] ❌ Chunk ${index + 1} error:`, error)
        throw new Error(`Supabase query error for chunk ${index + 1}: ${error.message}`)
      }

      console.log(`[API] ✅ Chunk ${index + 1}/${chunks.length} completed (${data?.length || 0} words)`)
      return data || []
    } catch (err) {
      console.error(`[API] ❌ Chunk ${index + 1} failed:`, err)
      throw err
    }
  })

  // 等待所有查询完成
  const results = await Promise.all(chunkPromises)

  // 合并结果（保持顺序）
  return results.flat()
}

/**
 * GET /api/vocabulary-words
 *
 * Query params:
 * - category: 分类名称（oxford-3000, ielts）
 * - limit: 返回数量限制（默认 100）
 * - offset: 分页偏移量
 *
 * V4 - 数据库动态查询版本
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('[API] 🚀 Fetching vocabulary words from database:', { category, limit, offset })

    // 第一步：验证 category 参数
    const categoryMap: Record<string, string> = {
      'oxford-3000': 'oxford',
      'ielts': 'ielts'
    }

    const dbCategory = categoryMap[category]

    if (!dbCategory) {
      return NextResponse.json(
        {
          error: 'Invalid category',
          message: `Category '${category}' not found. Supported: oxford-3000, ielts`,
          category
        },
        { status: 400 }
      )
    }

    // 第二步：查询数据库获取单词总数
    let supabase: any
    try {
      supabase = getSupabaseClient()
      console.log('[API] ✅ Supabase client initialized')
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Supabase initialization failed',
          message: (err as Error).message,
          hint: 'Check SUPABASE_SERVICE_ROLE_KEY environment variable'
        },
        { status: 500 }
      )
    }

    // 查询总数 - 使用 IN 查询（性能优于 LIKE）
    const { count: totalCount, error: countError } = await supabase
      .from('dictionary_cache')
      .select('word', { count: 'exact', head: true })
      .in('category', [dbCategory, `${dbCategory},ielts`, `ielts,${dbCategory}`])

    if (countError) {
      console.error('[API] ❌ 查询总数失败:', countError)
      throw countError
    }

    const totalWords = totalCount || 0
    console.log(`[API] ✅ Total words in database (category IN [${dbCategory}]): ${totalWords}`)

    // 检查 offset 是否超出范围
    if (offset >= totalWords) {
      console.log(`[API] ⚠️  Offset ${offset} exceeds total words ${totalWords}, returning empty list`)
      return NextResponse.json({
        success: true,
        words: [],
        total: totalWords,
        limit,
        offset
      })
    }

    // 第三步：查询分页数据 - 使用 IN 查询（性能优于 LIKE）
    const { data: wordsData, error: wordsError } = await supabase
      .from('dictionary_cache')
      .select('word, phonetic, definitions, translations, example, audio_r2_url, audio_url_us, audio_url_uk')
      .in('category', [dbCategory, `${dbCategory},ielts`, `ielts,${dbCategory}`])
      .order('word', { ascending: true })
      .range(offset, offset + limit)

    if (wordsError) {
      console.error('[API] ❌ 查询单词失败:', wordsError)
      throw wordsError
    }

    const words = wordsData || []
    console.log(`[API] ✅ Fetched ${words.length} words from database (offset ${offset}, limit ${limit})`)

    // 第四步：格式化数据
    const formattedWords = words.map((w: any) => ({
      word: w.word,
      phonetic: w.phonetic || '',
      definition: w.definitions ? JSON.stringify(w.definitions) : '{}',
      translations: w.translations ? JSON.stringify(w.translations) : '{}',
      example: w.example || '',
      audio_url: w.audio_r2_url || w.audio_url_us || '',
      audio_url_us: w.audio_url_us || '',
      audio_url_uk: w.audio_url_uk || '',
      // 无素材关联
      context_sentence: null,
      material_id: null,
      material_title: null,
      audio_timestamp: null,
      material_info: null,
      dictionary_cache: {
        example: w.example,
        definitions: w.definitions ? JSON.stringify(w.definitions) : '{}',
        translations: w.translations ? JSON.stringify(w.translations) : '{}',
        audio_url_us: w.audio_url_us,
        audio_url_uk: w.audio_url_uk
      }
    }))

    console.log('[API] ✅ Returning response:', {
      returned: formattedWords.length,
      total: totalWords,
      limit,
      offset
    })

    return NextResponse.json({
      success: true,
      words: formattedWords,
      total: totalWords,
      limit,
      offset
    })

  } catch (error: any) {
    // 暴露所有错误信息（调试用）
    console.error('[API] ❌ Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        message: error.message || 'Unknown error',
        stack: error.stack, // 暴露堆栈信息
        hint: 'Check server logs for details'
      },
      { status: 500 }
    )
  }
}
