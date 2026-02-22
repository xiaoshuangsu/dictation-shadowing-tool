import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { materialId, transcript } = await request.json()

    // Use service_role key for write access
    const supabase = createClient(
      'https://cuxotlijjnxbsirpdkgr.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || ''
    )

    const { error } = await supabase
      .from('materials')
      .update({ transcript })
      .eq('title', materialId)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
