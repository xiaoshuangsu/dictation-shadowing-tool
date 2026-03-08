import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data } = await supabase
  .from('materials')
  .select('title, thumbnail_path, video_path')
  .limit(2);

console.log(JSON.stringify(data, null, 2));
