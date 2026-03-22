/**
 * Word Definition API - 单词释义查询接口（带缓存）
 *
 * 优化策略：
 * 1. 优先查询 dictionary_cache 表
 * 2. 缓存命中则直接返回
 * 3. 未命中则调用 GLM API，并缓存结果
 *
 * POST /api/word-definition
 * Body: { word: string }
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// GLM API 配置
const GLM_API_KEY = process.env.GLM_API_KEY
const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

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

if (!GLM_API_KEY) {
  console.warn('⚠️ GLM_API_KEY 未设置，单词翻译功能将不可用')
}

interface WordDefinition {
  word: string
  phonetic: string
  definitions: {
    'zh-CN': string
    'zh-Hant': string
    'vi': string
    'en': string
  }
  example?: string
}

/**
 * POST /api/word-definition
 * 获取单词释义（优先从缓存）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { word } = body

    // 验证必填字段
    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'Invalid word parameter' },
        { status: 400 }
      )
    }

    const normalizedWord = word.toLowerCase().trim()

    if (normalizedWord.length < 2) {
      return NextResponse.json(
        { error: 'Word too short' },
        { status: 400 }
      )
    }

    console.log('[API] Fetching word definition:', normalizedWord)

    // 🔴 使用函数调用获取客户端
    const supabase = getSupabaseClient()

    // ============================================
    // 第一步：查询缓存
    // ============================================
    const { data: cachedData, error: cacheError } = await supabase
      .from('dictionary_cache')
      .select('*')
      .eq('word', normalizedWord)
      .single()

    if (cachedData) {
      // 缓存命中！
      console.log('[API] ✓ Cache hit for:', normalizedWord)

      // 增加命中计数
      await supabase
        .from('dictionary_cache')
        .update({ hit_count: (cachedData.hit_count || 0) + 1 })
        .eq('word', normalizedWord)

      // 解析多语言释义（新格式：definitions）
      let definitions = cachedData.definitions

      // 如果是新格式，直接使用
      // 如果是旧格式（definition_json），转换它
      if (!definitions && cachedData.definition_json) {
        const oldDef = typeof cachedData.definition_json === 'string'
          ? JSON.parse(cachedData.definition_json)
          : cachedData.definition_json

        definitions = {
          'zh-CN': oldDef?.zh || oldDef?.['zh-CN'] || '',
          'zh-Hant': oldDef?.['zh-Hant'] || '',
          'vi': oldDef?.vi || '',
          'en': oldDef?.en || ''
        }
      }

      // 如果是字符串，解析它
      if (typeof definitions === 'string') {
        try {
          definitions = JSON.parse(definitions)
        } catch {
          definitions = {}
        }
      }

      return NextResponse.json({
        success: true,
        definition: {
          word: cachedData.word,
          phonetic: cachedData.phonetic || '',
          definitions: definitions || {
            'zh-CN': '暂无释义',
            'zh-Hant': '暫無釋義',
            'vi': 'Không có định nghĩa',
            'en': 'No definition'
          },
          example: cachedData.example || undefined
        },
        // 🔴 添加音频 URL
        audioUrls: {
          us: cachedData.audio_url_us || null,
          uk: cachedData.audio_url_uk || null
        },
        fromCache: true
      })
    }

    // ============================================
    // 第二步：缓存未命中，调用 GLM API
    // ============================================
    console.log('[API] ✗ Cache miss for:', normalizedWord, '- calling GLM API...')

    // 检查 API Key
    if (!GLM_API_KEY) {
      return NextResponse.json(
        { error: 'Translation service unavailable' },
        { status: 503 }
      )
    }

    // 调用 GLM API
    const glmResponse = await fetch(`${GLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的多语言词典助手。请为英语单词提供准确、简洁的多语言释义。

⚠️ **重要限制：只提供以下语言的释义，不要添加其他语言**

  - zh-CN: 简体中文释义
  - zh-Hant: 繁體中文释义
  - vi: 越南语释义
  - en: 英语释义

请严格按照以下 JSON 格式返回结果（不要有任何额外文字）：
{
  "word": "单词（小写）",
  "phonetic": "音标（如 /həˈləʊ/）",
  "zh-CN": "简体中文释义（最多3个常用释义，用分号分隔）",
  "zh-Hant": "繁體中文释义（最多3个常用释义，用分号分隔）",
  "vi": "越南语释义（最多3个常用释义，用分号分隔）",
  "en": "英语释义（最多3个常用释义，用分号分隔）",
  "example": "英文例句（选填）"
}

⚠️ **严格要求：**
1. **ONLY** provide definitions for: zh-CN, zh-Hant, vi, en
2. **DO NOT** include any other languages
3. 每种语言最多 3 个常用释义，用分号分隔
4. 释义要地道、自然、简洁

示例：
输入：hello
输出：
{
  "word": "hello",
  "phonetic": "/həˈləʊ/",
  "zh-CN": "你好；问候；喂",
  "zh-Hant": "你好；問候；喂",
  "vi": "xin chào; chào hỏi",
  "en": "a greeting; an expression of greeting",
  "example": "Hello, how are you?"
}`
          },
          {
            role: 'user',
            content: normalizedWord
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
        top_p: 0.7
      })
    })

    if (!glmResponse.ok) {
      const errorText = await glmResponse.text()
      console.error('[API] GLM API error:', glmResponse.status, errorText)
      return NextResponse.json(
        { error: 'Translation service error', details: errorText },
        { status: 502 }
      )
    }

    const glmData = await glmResponse.json()
    const content = glmData.choices?.[0]?.message?.content

    if (!content) {
      console.error('[API] GLM API empty response')
      return NextResponse.json(
        { error: 'Empty translation response' },
        { status: 502 }
      )
    }

    console.log('[API] GLM response:', content)

    // 解析 GLM 返回的 JSON
    let glmDefinition: {
      word: string
      phonetic: string
      'zh-CN': string
      'zh-Hant'?: string
      vi: string
      en: string
      example?: string
    }

    try {
      // 尝试直接解析 JSON
      glmDefinition = JSON.parse(content)
    } catch (parseError) {
      // 如果解析失败，尝试提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        glmDefinition = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('无法解析 GLM 响应')
      }
    }

    // 验证返回的数据格式
    if (!glmDefinition.word || !glmDefinition['zh-CN']) {
      throw new Error('无效的释义格式')
    }

    // ============================================
    // 第三步：存入缓存（新格式：definitions）
    // ============================================
    const definitions = {
      'zh-CN': glmDefinition['zh-CN'],
      'zh-Hant': glmDefinition['zh-Hant'] || '',
      'vi': glmDefinition.vi || '',
      'en': glmDefinition.en || ''
    }

    const { error: insertError } = await supabase
      .from('dictionary_cache')
      .insert({
        word: normalizedWord,
        phonetic: glmDefinition.phonetic || '',
        definitions: definitions,
        example: glmDefinition.example || null
      })

    if (insertError) {
      console.warn('[API] Failed to cache word:', insertError.message)
      // 不影响返回结果，继续执行
    } else {
      console.log('[API] ✓ Cached word:', normalizedWord)
    }

    return NextResponse.json({
      success: true,
      definition: {
        word: glmDefinition.word,
        phonetic: glmDefinition.phonetic || '',
        definitions,
        example: glmDefinition.example
      },
      fromCache: false
    })

  } catch (error: any) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
