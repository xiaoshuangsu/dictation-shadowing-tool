import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { materialId, transcript } = body

    console.log('📝 Saving transcript:', { materialId, sentenceCount: transcript?.length })

    // 验证输入
    if (!materialId) {
      return NextResponse.json(
        { error: 'materialId is required' },
        { status: 400 }
      )
    }

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: 'transcript must be an array' },
        { status: 400 }
      )
    }

    // 过滤掉空句子的 transcript
    const validTranscript = transcript.filter(s => s.text && s.text.trim().length > 0)

    console.log(`   Filtered: ${transcript?.length} → ${validTranscript.length} sentences`)

    // Use service_role key for write access
    const supabase = createClient(
      'https://cuxotlijjnxbsirpdkgr.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || ''
    )

    const { data, error } = await supabase
      .from('materials')
      .update({
        transcript: validTranscript,
        updated_at: new Date().toISOString()
      })
      .eq('title', materialId)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update transcript', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Saved successfully:', materialId)
    return NextResponse.json({
      success: true,
      message: 'Transcript updated successfully',
      sentenceCount: validTranscript.length
    })
  } catch (error: any) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
