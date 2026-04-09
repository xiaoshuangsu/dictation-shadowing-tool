/**
 * Dictionary Batch API - 批量获取单词释义
 *
 * 用途：复习弹窗加载时，批量补全缺失的单词释义
 * 数据源：Supabase dictionary_cache 表
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const getSupabaseClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  return createClient(
    'https://cuxotlijjnxbsirpdkgr.supabase.co',
    serviceKey || ''
  )
}

/**
 * POST /api/dictionary-batch
 * 批量获取单词释义
 *
 * Body:
 * - words: string[] - 单词列表
 * - targetLanguage?: string - 目标语言（如 'zh', 'zh_hant', 'vi' 等）
 *
 * 返回:
 * - Record<word, { phonetic, definitions, example, audio_url_us, audio_url_uk, matched_translation }>
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { words, targetLanguage = 'zh' } = body

    if (!words || !Array.isArray(words)) {
      return NextResponse.json(
        { error: 'Invalid request: words array required' },
        { status: 400 }
      )
    }

    if (words.length === 0) {
      return NextResponse.json({ words: {} })
    }

    // 标准化单词列表（小写、去重）
    const normalizedWords = Array.from(new Set(
      words.map(w => w?.toLowerCase().trim()).filter(w => w)
    ))

    console.log('[Dictionary Batch] 查询单词数量:', normalizedWords.length, '目标语言:', targetLanguage)
    console.log('[Dictionary Batch] 单词列表:', normalizedWords.slice(0, 5).join(', '), normalizedWords.length > 5 ? '...' : '')

    const supabase = getSupabaseClient()

    // 批量查询 dictionary_cache
    const { data: cacheData, error } = await supabase
      .from('dictionary_cache')
      .select('word, phonetic, definitions, example, audio_url_us, audio_url_uk')
      .in('word', normalizedWords)

    if (error) {
      console.error('[Dictionary Batch] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch definitions', details: error.message },
        { status: 500 }
      )
    }

    // 🔥 语言映射：将前端语言代码映射到数据库字段
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

    const dbLangKey = langMap[targetLanguage] || 'zh-CN'

    // 构建返回对象
    const wordsMap: Record<string, any> = {}

    if (cacheData) {
      cacheData.forEach(item => {
        // 🔥 提取目标语言的翻译
        const matchedTranslation = item.definitions?.[dbLangKey] || ''

        wordsMap[item.word] = {
          phonetic: item.phonetic || '',
          definitions: item.definitions || {},
          example: item.example || '',
          audio_url_us: item.audio_url_us || '',
          audio_url_uk: item.audio_url_uk || '',
          // 🔥 新增：匹配的翻译
          matched_translation: matchedTranslation
        }

        // 🔍 调试：打印第一个单词的匹配情况
        if (item.word === normalizedWords[0]) {
          console.log('[Dictionary Batch] 📝 单词:', item.word, '| 目标语言:', targetLanguage, '| DB Key:', dbLangKey, '| 匹配翻译:', matchedTranslation ? '✅' : '❌')
        }
      })
    }

    // 统计命中情况
    const hitCount = Object.keys(wordsMap).length
    const missWords = normalizedWords.filter(w => !wordsMap[w])

    console.log('[Dictionary Batch] ✅ 命中:', hitCount, '| 未命中:', missWords.length)

    if (missWords.length > 0) {
      console.log('[Dictionary Batch] ⚠️  未命中单词:', missWords.slice(0, 10).join(', '))
    }

    return NextResponse.json({
      success: true,
      words: wordsMap,
      hitCount,
      missCount: missWords.length,
      targetLanguage
    })
  } catch (error: any) {
    console.error('[Dictionary Batch] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
