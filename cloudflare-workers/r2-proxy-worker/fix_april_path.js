const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

dotenv.config({ path: '../../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function fixPath() {
  const { data: current } = await supabase
    .from('materials')
    .select('video_path, audio_path, thumbnail_path')
    .eq('id', '86d8e031-1dc0-4b0b-a5c1-50a0601a8dc3')
    .single()

  console.log('修复前:')
  console.log('  video_path:', current.video_path)
  console.log('  audio_path:', current.audio_path)
  console.log('  thumbnail_path:', current.thumbnail_path)

  const toRelative = (url) => {
    if (!url) return url
    if (url.includes('media.shadowhub.app')) {
      const u = new URL(url)
      return u.pathname.substring(1)
    }
    return url
  }

  const updates = {
    video_path: toRelative(current.video_path),
    audio_path: toRelative(current.audio_path),
    thumbnail_path: toRelative(current.thumbnail_path)
  }

  console.log('\n修复后:')
  console.log('  video_path:', updates.video_path)
  console.log('  audio_path:', updates.audio_path)
  console.log('  thumbnail_path:', updates.thumbnail_path)

  const { data: updated } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', '86d8e031-1dc0-4b0b-a5c1-50a0601a8dc3')
    .select()
    .single()

  console.log('\n✅ 修复成功！')
}

fixPath()
