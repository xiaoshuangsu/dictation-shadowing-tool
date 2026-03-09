const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

dotenv.config({ path: '../../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkTelephone() {
  const { data } = await supabase
    .from('materials')
    .select('video_path')
    .eq('title', '[Telephone Conversations] Can I Speak to Sally? - Easy Dialogue - Role Play')
    .single()

  console.log('video_path:', data.video_path)
  console.log('长度:', data.video_path?.length)
  console.log('以 .mp4 结尾?', data.video_path?.endsWith('.mp4'))
  console.log('以 http 开头?', data.video_path?.startsWith('http'))
}

checkTelephone()
