# 播放器重构总结 - YouTube Iframe 支持

## 🎯 重构目标

重构播放器逻辑以支持 YouTube Iframe API，同时保持现有 R2 存储（含音频和视频）的正常运作。

## ✅ 完成的工作

### 1. 数据库迁移脚本

**文件**: `supabase/migrations/add_source_type_and_youtube.sql`

新增字段：
- `source_type` (TEXT): 素材来源类型，'r2' 或 'youtube'（默认 'r2'）
- `youtube_id` (TEXT): YouTube 视频 ID
- `video_path` (TEXT): R2 视频文件路径

数据完整性约束：
- 当 `source_type='youtube'` 时，`youtube_id` 不能为空
- 创建了相应的索引以加速查询

### 2. Material 类型定义更新

**文件**: `src/lib/supabase/client.ts`

```typescript
export interface Material {
  // ... 原有字段
  source_type: 'r2' | 'youtube'
  youtube_id?: string | null
  video_path?: string | null
  transcript?: any
}
```

### 3. YouTube 播放器组件

**文件**: `src/components/YouTubePlayer.tsx`

特性：
- 使用 YouTube Iframe API
- 实现与 AudioPlayer/VideoPlayer 一致的接口
- 支持 play(), pause(), seekTo(time), setPlaybackRate(rate)
- 时间戳同步（onTimeUpdate）
- 加载状态回调（onLoadingChange）
- 自动停止到句子结束时间

### 4. 统一播放器接口组件

**文件**: `src/components/UniversalPlayer.tsx`

根据素材类型自动选择合适的播放器：
- `source_type='youtube'` → YouTubePlayer
- `source_type='r2' + video_path` → VideoPlayer
- `source_type='r2' + audio_path` → AudioPlayer

导出辅助函数：
- `getPlayerType(material)`: 获取素材的播放器类型

### 5. PracticePage 集成

**文件**: `src/app/topics/[category]/[slug]/PracticePage.tsx`

主要更新：
- 导入 YouTubePlayer 组件
- 添加 `getPlayerInfo()` 辅助函数，根据素材类型获取播放器信息
- 更新左侧栏渲染逻辑：
  - YouTube 视频 → YouTubePlayer
  - R2 视频 → VideoPlayer
  - 纯音频 → 显示封面图
- 更新练习区域渲染逻辑：
  - R2 素材 → AudioPlayer（听写和影子跟读）
  - YouTube 素材 → 显示提示信息（音频由视频播放器控制）

## 📋 测试清单

### 1. 数据库测试

- [ ] 执行迁移脚本：`add_source_type_and_youtube.sql`
- [ ] 验证新字段已添加到 `materials` 表
- [ ] 验证约束正常工作（youtube_id 在 source_type='youtube' 时必填）

### 2. R2 音频素材测试（现有功能）

- [ ] 纯音频素材正常播放
- [ ] 左侧栏显示封面图
- [ ] 听写模式正常工作
- [ ] 影子跟读模式正常工作
- [ ] 时间戳同步准确
- [ ] 播放速度控制正常

### 3. R2 视频素材测试（现有功能）

- [ ] 视频正常显示和播放
- [ ] 左侧栏显示视频播放器
- [ ] 音频播放器正常工作（听写和影子跟读）
- [ ] 音视频同步正常
- [ ] 视频降级机制正常工作（移动端）

### 4. YouTube 视频素材测试（新功能）

**测试数据准备**：
```sql
-- 插入测试数据
INSERT INTO materials (
  title,
  category,
  difficulty,
  source_type,
  youtube_id,
  audio_path,
  thumbnail_path,
  transcript,
  audio_size
) VALUES (
  'YouTube Test Video',
  'Test Category',
  'A2',
  'youtube',
  'dQw4w9WgXcQ',  -- 替换为实际的 YouTube 视频 ID
  '',  -- YouTube 不需要 audio_path
  'thumbnails/test-cover.jpg',
  '[{
    "id": 1,
    "text": "This is a test sentence.",
    "startTime": 0.0,
    "endTime": 2.5,
    "translation": "这是一个测试句子。"
  }]'::jsonb,
  0
);
```

**功能测试**：
- [ ] YouTube 视频正常显示
- [ ] YouTube 播放器控制正常（播放、暂停、跳转）
- [ ] 时间戳同步准确
- [ ] 播放速度控制正常
- [ ] 句子播放自动停止
- [ ] 左侧栏显示 YouTube 视频播放器
- [ ] 练习区域显示提示信息（音频由视频播放器控制）

### 5. 跨素材类型切换测试

- [ ] 从 R2 音频切换到 YouTube 视频
- [ ] 从 YouTube 视频切换到 R2 视频
- [ ] 从 R2 视频切换到 R2 音频
- [ ] 确保每次切换后播放器正常工作

### 6. 移动端测试

- [ ] iPhone Safari 访问页面
- [ ] R2 音频素材正常播放
- [ ] R2 视频素材正常显示（降级机制）
- [ ] YouTube 视频素材正常显示
- [ ] 播放控制响应灵敏

### 7. 性能测试

- [ ] 页面加载时间正常（< 2s）
- [ ] 播放器初始化时间正常（< 1s）
- [ ] YouTube API 加载时间正常
- [ ] 内存占用正常

## 🚀 部署步骤

1. **数据库迁移**
   ```bash
   # 在 Supabase Dashboard SQL Editor 中执行
   # 或使用 Supabase CLI
   supabase db push
   ```

2. **前端部署**
   ```bash
   npm run build
   npm run export
   # 部署到 Cloudflare Pages
   ```

3. **验证**
   - 访问现有素材，确保 R2 音频和视频正常工作
   - 创建 YouTube 测试素材，验证 YouTube 播放器正常工作

## 📝 注意事项

1. **YouTube API 限制**
   - YouTube Iframe API 有一些限制，如无法直接访问音频流
   - 需要确保 YouTube 视频 ID 有效

2. **音频路径处理**
   - YouTube 素材不需要 `audio_path` 字段
   - R2 素材必须提供有效的 `audio_path`

3. **影子跟读限制**
   - YouTube 素材暂不支持影子跟读（因为无法直接访问音频流）
   - 未来可以考虑使用 YouTube Iframe API 的音频控制功能

4. **向后兼容**
   - 所有现有 R2 素材继续正常工作
   - `source_type` 默认值为 'r2'，确保现有数据不受影响

## 🔧 未来改进

1. **YouTube 影子跟读支持**
   - 研究 YouTube Iframe API 的音频控制能力
   - 可能需要使用 Web Audio API 来处理 YouTube 音频

2. **播放器抽象优化**
   - 考虑创建更统一的播放器接口
   - 减少代码重复

3. **错误处理增强**
   - YouTube 视频加载失败时的降级策略
   - 更友好的错误提示

## 📚 相关文档

- [YouTube Iframe API Documentation](https://developers.google.com/youtube/iframe_api_reference)
- [Claude Code Guide](./claude\ code\ guide.md)
- [Database Migration Guide](./supabase/migrations/)
