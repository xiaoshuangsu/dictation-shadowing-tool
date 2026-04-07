/**
 * Vocabulary Words API - 获取词汇库单词（Oxford 3000, IELTS 等）
 *
 * 支持的操作：
 * - GET: 根据分类获取单词列表
 *
 * 工作流程：
 * 1. 从 JSON 文件读取单词列表（oxford-3000.json / ielts.json）
 * 2. 使用 Supabase IN 查询从 dictionary_cache 表获取完整数据
 * 3. 支持分页（limit/offset）
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// 强制声明动态渲染
export const dynamic = 'force-dynamic'

/**
 * 读取单词列表 JSON 文件
 */
function getWordList(category: string): string[] {
  try {
    let fileName = ''

    if (category === 'oxford-3000') {
      fileName = 'oxford-3000.json'
    } else if (category === 'ielts') {
      fileName = 'ielts.json'
    } else {
      return []
    }

    const filePath = path.join(process.cwd(), 'src', 'data', fileName)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const wordList = JSON.parse(fileContent)

    console.log(`[API] ✅ Loaded ${wordList.length} words from ${fileName}`)
    return wordList
  } catch (error) {
    console.error(`[API] ❌ Failed to load word list for category '${category}':`, error)
    return []
  }
}

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
 * 根据分类获取单词列表
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

    console.log('[API] Fetching vocabulary words:', { category, limit, offset })

    // 🔍 第一步：从 JSON 文件读取完整单词列表
    const wordList = getWordList(category)

    if (wordList.length === 0) {
      return NextResponse.json(
        {
          error: category === 'oxford-3000' || category === 'ielts'
            ? 'Word list not found or empty'
            : 'Invalid category. Supported: oxford-3000, ielts',
          category
        },
        { status: 400 }
      )
    }

    // 🔍 第二步：分页切片（只查询当前页需要的单词）
    const paginatedWords = wordList.slice(offset, offset + limit)

    console.log(`[API] 📄 Page ${offset}-${offset + limit}/${wordList.length} words`)

    // 🔍 第三步：使用 Supabase IN 查询从 dictionary_cache 获取数据
    const supabase = getSupabaseClient()

    const { data: words, error } = await supabase
      .from('dictionary_cache')
      .select('word, phonetic, definition_json, example, audio_r2_url, audio_url_us, audio_url_uk')
      .in('word', paginatedWords)
      .order('word', { ascending: true })

    if (error) {
      console.error('[API] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary words', details: error.message },
        { status: 500 }
      )
    }

    // 转换数据格式以匹配前端期望的结构
    const formattedWords = (words || []).map((w: any) => ({
      word: w.word,
      phonetic: w.phonetic || '',
      // 将 definition_json 转换回 definition 字符串格式（前端兼容）
      definition: JSON.stringify(w.definition_json),
      example: w.example || '',
      audio_url: w.audio_r2_url || w.audio_url_us || '',
      audio_url_us: w.audio_url_us || '',
      audio_url_uk: w.audio_url_uk || '',
      // 这些分类没有素材关联
      context_sentence: null,
      material_id: null,
      material_title: null,
      audio_timestamp: null,
      material_info: null,
      dictionary_cache: {
        example: w.example,
        definitions: JSON.stringify(w.definition_json),
        audio_url_us: w.audio_url_us,
        audio_url_uk: w.audio_url_uk
      }
    }))

    console.log('[API] ✅ Fetched vocabulary words:', {
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
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
