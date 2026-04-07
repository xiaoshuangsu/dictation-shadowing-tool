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
function getWordList(category: string): { words: string[]; error?: string } {
  try {
    let fileName = ''

    if (category === 'oxford-3000') {
      fileName = 'oxford-3000.json'
    } else if (category === 'ielts') {
      fileName = 'ielts.json'
    } else {
      return { words: [], error: `Invalid category: ${category}` }
    }

    const filePath = path.join(process.cwd(), 'src', 'data', fileName)

    // 🔍 调试日志：打印文件路径
    console.log(`[API] 📂 Reading file: ${filePath}`)

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return { words: [], error: `File not found: ${filePath}` }
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // 🔍 调试日志：打印文件内容前 100 字符
    console.log(`[API] 📄 File content preview: ${fileContent.substring(0, 100)}...`)

    let wordList: string[]

    // 尝试解析 JSON
    try {
      wordList = JSON.parse(fileContent)
    } catch (parseError) {
      return { words: [], error: `JSON parse error: ${(parseError as Error).message}` }
    }

    // 验证是数组
    if (!Array.isArray(wordList)) {
      return { words: [], error: 'Invalid format: word list must be an array' }
    }

    // 验证元素都是字符串
    const invalidWords = wordList.filter((w: any) => typeof w !== 'string')
    if (invalidWords.length > 0) {
      return { words: [], error: `Invalid words: ${invalidWords.slice(0, 5).join(', ')}...` }
    }

    console.log(`[API] ✅ Loaded ${wordList.length} words from ${fileName}`)
    return { words: wordList }
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error(`[API] ❌ Failed to load word list for category '${category}':`, errorMsg)
    return { words: [], error: errorMsg }
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
    const { words: wordList, error: wordListError } = getWordList(category)

    if (wordListError || wordList.length === 0) {
      console.error('[API] ❌ Word list error:', wordListError)
      return NextResponse.json(
        {
          error: wordListError || 'Word list not found or empty',
          category,
          hint: 'Make sure JSON files exist in src/data/ directory'
        },
        { status: 400 }
      )
    }

    // 🔍 第二步：分页切片（只查询当前页需要的单词）
    const paginatedWords = wordList.slice(offset, offset + limit)

    console.log(`[API] 📄 Page ${offset}-${offset + limit}/${wordList.length} words`)

    // 🔍 第三步：使用 Supabase IN 查询从 dictionary_cache 获取数据
    const supabase = getSupabaseClient()

    let words: any[] | null = null
    let supabaseError: any = null

    try {
      const result = await supabase
        .from('dictionary_cache')
        .select('word, phonetic, definition_json, example, audio_r2_url, audio_url_us, audio_url_uk')
        .in('word', paginatedWords)
        .order('word', { ascending: true })

      words = result.data
      supabaseError = result.error
    } catch (dbError) {
      console.error('[API] ❌ Database query error:', dbError)
      supabaseError = dbError
    }

    if (supabaseError) {
      console.error('[API] ❌ Supabase error:', supabaseError)
      return NextResponse.json(
        {
          error: 'Failed to fetch vocabulary words from database',
          details: supabaseError.message || String(supabaseError),
          words_requested: paginatedWords.length
        },
        { status: 500 }
      )
    }

    // 转换数据格式以匹配前端期望的结构
    const formattedWords = (words || []).map((w: any) => {
      try {
        return {
          word: w.word,
          phonetic: w.phonetic || '',
          // 将 definition_json 转换回 definition 字符串格式（前端兼容）
          definition: w.definition_json ? JSON.stringify(w.definition_json) : '{}',
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
            definitions: w.definition_json ? JSON.stringify(w.definition_json) : '{}',
            audio_url_us: w.audio_url_us,
            audio_url_uk: w.audio_url_uk
          }
        }
      } catch (formatError) {
        console.error(`[API] ❌ Format error for word '${w.word}':`, formatError)
        return null
      }
    }).filter((w: any) => w !== null) // 过滤掉格式化失败的单词

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
    console.error('[API] ❌ Unexpected error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
