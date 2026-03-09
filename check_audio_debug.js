// 检查 April Fool's Day Joke 音频的实际内容
const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM3NzQ1MjcsImV4cCI6MjAyOTM1MDUyN30.bH4fAQh8c3fbK1b-LuvcIrs7e0Jz4rrWczx9sXb9c2g'

async function checkAudio() {
  const materialId = '86d8e031-1dc0-4b0b-a5c1-50a0601a8dc3'

  const response = await fetch(`${supabaseUrl}/rest/v1/materials?id=eq.${materialId}&select=*`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  })

  console.log('响应状态:', response.status)
  const text = await response.text()
  console.log('响应长度:', text.length)

  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    console.log('解析失败，原始响应:', text.substring(0, 200))
    return
  }

  console.log('返回数据:', Array.isArray(data) ? data.length + ' 条记录' : typeof data)
  if (!Array.isArray(data) || data.length === 0) {
    console.log('未找到素材')
    return
  }
  if (data.length === 0) {
    console.log('未找到素材')
    return
  }

  console.log('=== 素材信息 ===')
  console.log('标题:', data[0].title)
  console.log('音频路径:', data[0].audio_path)
  console.log('视频路径:', data[0].video_path)
  console.log('总时长:', data[0].duration, '秒')

  console.log('\n=== 前 3 句时间戳 ===')
  for (let i = 0; i < 3; i++) {
    const s = data[0].transcript[i]
    const num = i + 1
    console.log(num + '. "' + s.text + '"')
    console.log('   时间: ' + s.startTime + 's ~ ' + s.endTime + 's')
  }

  console.log('\n=== 问题诊断 ===')
  const first = data[0].transcript[0]
  const second = data[0].transcript[1]

  // 检查第一句和第二句之间是否有间隔
  const gap = parseFloat(second.startTime) - parseFloat(first.endTime)
  console.log('第一句结束:', first.endTime + 's')
  console.log('第二句开始:', second.startTime + 's')
  console.log('间隔:', gap + 's')

  if (gap < 0) {
    console.log('⚠️ 警告：时间戳重叠！')
  }
}

checkAudio()
