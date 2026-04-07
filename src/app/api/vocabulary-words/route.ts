/**
 * Vocabulary Words API - 获取词汇库单词（Oxford 3000, IELTS 等）
 *
 * 支持的操作：
 * - GET: 根据分类获取单词列表
 *
 * V2 - 紧急修复版本：
 * - 使用 TypeScript 常量代替 JSON 文件（消除 fs 路径风险）
 * - 分批查询 Supabase（每批 50 个单词）
 * - 暴露底层错误信息（便于调试）
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { OXFORD_3000_WORDS } from '@/data/oxford-3000'
import { IELTS_WORDS } from '@/data/ielts'

// 强制声明动态渲染
export const dynamic = 'force-dynamic'

/**
 * 获取单词列表
 */
function getWordList(category: string): string[] {
  switch (category) {
    case 'oxford-3000':
      return OXFORD_3000_WORDS
    case 'ielts':
      return IELTS_WORDS
    default:
      return []
  }
}

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
 * 分批查询 Supabase
 * @param words - 要查询的单词列表
 * @param chunkSize - 每批大小（默认 50）
 */
async function fetchWordsInChunks(
  supabase: any,
  words: string[],
  chunkSize: number = 50
): Promise<any[]> {
  const results: any[] = []

  // 分批处理
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)

    console.log(`[API] 📦 Fetching chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(words.length / chunkSize)} (${chunk.length} words)`)

    try {
      const { data, error } = await supabase
        .from('dictionary_cache')
        .select('word, phonetic, definitions, example, audio_r2_url, audio_url_us, audio_url_uk')
        .in('word', chunk)
        .order('word', { ascending: true })

      if (error) {
        console.error(`[API] ❌ Chunk ${Math.floor(i / chunkSize) + 1} error:`, error)
        throw new Error(`Supabase query error for chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`)
      }

      if (data) {
        results.push(...data)
      }
    } catch (err) {
      console.error(`[API] ❌ Chunk ${Math.floor(i / chunkSize) + 1} failed:`, err)
      throw err
    }
  }

  return results
}

/**
 * GET /api/vocabulary-words
 *
 * Query params:
 * - category: 分类名称（oxford-3000, ielts）
 * - limit: 返回数量限制（默认 100）
 * - offset: 分页偏移量
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('[API] 🚀 Fetching vocabulary words:', { category, limit, offset })

    // 第一步：获取单词列表
    const wordList = getWordList(category)

    if (wordList.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid category',
          message: `Category '${category}' not found. Supported: oxford-3000, ielts`,
          category
        },
        { status: 400 }
      )
    }

    console.log(`[API] ✅ Total words in list: ${wordList.length}`)

    // 第二步：分页切片
    const paginatedWords = wordList.slice(offset, offset + limit)
    console.log(`[API] 📄 Page slice: ${paginatedWords.length} words (offset ${offset})`)

    // 第三步：初始化 Supabase 客户端
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

    // 第四步：分批查询数据库
    let words: any[]
    try {
      words = await fetchWordsInChunks(supabase, paginatedWords, 50)
      console.log(`[API] ✅ Fetched ${words.length} words from database`)
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Database query failed',
          message: (err as Error).message,
          words_requested: paginatedWords.length,
          hint: 'Check Supabase connection and dictionary_cache table'
        },
        { status: 500 }
      )
    }

    // 第五步：格式化数据
    const formattedWords = words.map((w: any) => ({
      word: w.word,
      phonetic: w.phonetic || '',
      definition: w.definitions ? JSON.stringify(w.definitions) : '{}',
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
        audio_url_us: w.audio_url_us,
        audio_url_uk: w.audio_url_uk
      }
    }))

    console.log('[API] ✅ Returning response:', {
      returned: formattedWords.length,
      total: wordList.length,
      limit,
      offset
    })

    return NextResponse.json({
      success: true,
      words: formattedWords,
      total: wordList.length,
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
