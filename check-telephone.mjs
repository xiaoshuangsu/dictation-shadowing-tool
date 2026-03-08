import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data } = await supabase
  .from('materials')
  .select('*')
  .ilike('title', '%telephone%')
  .single();

console.log('Telephone Conversation 素材信息:');
console.log('标题:', data.title);
console.log('分类:', data.category);
console.log('视频路径:', data.video_path);
console.log('音频路径:', data.audio_path);
console.log('缩略图:', data.thumbnail_path);
console.log('Slug:', data.title);
