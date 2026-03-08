import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk';

const supabase = createClient(supabaseUrl, supabaseKey);

// 检查 "Telephone Conversation" 素材
const { data: telephone } = await supabase
  .from('materials')
  .select('title, video_path, audio_path')
  .ilike('title', '%telephone%')
  .single();

console.log('=== Telephone Conversation ===');
console.log('标题:', telephone.title);
console.log('视频路径:', telephone.video_path);
console.log('音频路径:', telephone.audio_path);

// 检查有视频的素材
const { data: withVideo } = await supabase
  .from('materials')
  .select('title, video_path')
  .not('video_path', 'is', null)
  .limit(3);

console.log('\n=== 有视频的素材示例 ===');
withVideo.forEach(m => {
  console.log(`${m.title}: ${m.video_path}`);
});
