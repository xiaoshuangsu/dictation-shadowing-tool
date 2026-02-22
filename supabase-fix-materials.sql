-- 查看现有 materials 表结构
\d materials

-- 启用 RLS（如果还没启用）
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Enable read access for all users" ON materials;
DROP POLICY IF EXISTS "Allow public access" ON materials;

-- 允许公开读取 materials 表
CREATE POLICY "Allow public read access"
ON materials
FOR SELECT
TO public
USING (true);

-- 插入测试数据（使用 gen_random_uuid() 生成 UUID）
INSERT INTO materials (id, title, category, difficulty, audio_path, thumbnail_path, audio_size, duration)
VALUES
  (gen_random_uuid(), 'Daily Conversation 1', '日常生活', 'A1', 'audio/daily-1.mp3', 'thumbnails/daily-1.jpg', 1024000, 60),
  (gen_random_uuid(), 'Historical Speech', '历史演讲', 'B1', 'audio/speech-1.mp3', 'thumbnails/speech-1.jpg', 2048000, 180);

-- 验证插入的数据
SELECT id, title, category, difficulty FROM materials;
