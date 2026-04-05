/**
 * Get Cloze Data API - 获取素材的挖空数据
 *
 * GET /api/cloze/{materialId}
 * Returns: { data: ClozeSentence[] }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 🔴 防御性修复：强制声明动态渲染
export const dynamic = 'force-dynamic'

interface ClozeSentence {
  sentence_position: number
  blank_position: number
  blank_word: string
  sentence_with_blank: string
  original_sentence: string
  weight: number
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params

    // 从环境变量获取 Supabase 配置
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 查询素材
    const { data: material, error } = await supabase
      .from('materials')
      .select('id, title, transcript')
      .eq('id', materialId)
      .single()

    if (error || !material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // 解析 transcript
    const transcript = material.transcript
    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { data: [] }
      )
    }

    // 提取挖空数据
    const clozeData: ClozeSentence[] = []

    for (const sentence of transcript) {
      const blanks = sentence.blanks

      if (blanks && Array.isArray(blanks) && blanks.length > 0) {
        // 取第一个挖空（当前每句只挖空一个词）
        const blank = blanks[0]
        const blankWord = blank.word
        const blankPosition = blank.index
        const sentenceText = sentence.text || ''

        // 生成带挖空的句子
        const words = (sentenceText || '').split(' ')
        if (blankPosition >= 0 && blankPosition < words.length) {
          words[blankPosition] = `[${blankWord}]`  // 用 [word] 格式标记挖空
          const sentenceWithBlank = words.join(' ')

          clozeData.push({
            sentence_position: sentence.id || 0,
            blank_position: blankPosition,
            blank_word: blankWord,
            sentence_with_blank: sentenceWithBlank,
            original_sentence: sentenceText,
            weight: blank.weight || 0
          })
        }
      }
    }

    console.log(`📊 [API] /api/cloze/${materialId}: 返回 ${clozeData.length} 条挖空数据`)

    return NextResponse.json({
      data: clozeData,
      material: {
        id: material.id,
        title: material.title
      }
    })

  } catch (error: any) {
    console.error('❌ [API] /api/cloze error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
