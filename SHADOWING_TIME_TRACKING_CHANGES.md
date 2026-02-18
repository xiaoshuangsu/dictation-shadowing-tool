# Shadowing 真实播放时间统计 - 修改总结

## 修改日期
2024年（具体日期待记录）

## 修改目的
将 Shadowing 时间统计从"句数 × 固定分钟数"改为基于真实音频播放时长的累计。

## 核心改动

### 1. 数据库 Schema 变更

#### 新增字段：`duration_seconds`
**文件**: `/Users/a/dictation/supabase/migrations/add_duration_seconds.sql`

```sql
ALTER TABLE public.practice_records
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
```

**用途**：记录实际音频播放时长（秒），特别是 Shadowing 练习

**需要在 Supabase SQL Editor 中执行此脚本**

---

### 2. 客户端类型定义

#### 更新 `PracticeRecord` 接口
**文件**: `/Users/a/dictation/src/lib/supabase/client.ts`

```typescript
export interface PracticeRecord {
  id: string
  user_id: string
  sentence_id: number
  sentence_text: string
  practice_mode: 'dictation' | 'shadowing'
  dictation_mode: 'word' | 'whole' | null
  is_correct: boolean
  used_show_words: boolean
  audio_title: string
  duration_seconds: number | null  // 新增
  completed_at: string
}
```

#### 更新 `savePracticeRecord` 函数
```typescript
export async function savePracticeRecord(data: {
  // ... 其他字段
  durationSeconds?: number  // 新增参数
})
```

---

### 3. ShadowingPanel 组件改造

**文件**: `/Users/a/dictation/src/components/ShadowingPanel.tsx`

#### 新增状态管理
```typescript
// 真实音频播放时间跟踪
const [totalPlayedSeconds, setTotalPlayedSeconds] = useState(0)
const [isPlaying, setIsPlaying] = useState(false)
const lastPlayPositionRef = useRef<number>(0)
const lastUpdateTimeRef = useRef<number>(0)
const totalPlayedSecondsRef = useRef<number>(0)
```

#### 修改 `playOriginal` 函数
添加音频播放事件监听：
- `play`：开始计时
- `pause`：暂停计时，累计已播放时间
- `timeupdate`：持续更新播放时间
- `ended`：结束计时，累计最后一段播放时间

#### 修改 `onComplete` 回调
**之前**：
```typescript
onComplete?: (isCorrect: boolean, practiceMinutes: number) => void
```

**之后**：
```typescript
onComplete?: (isCorrect: boolean, durationSeconds: number) => void
```

**调用时**：
```typescript
const durationSeconds = Math.max(1, Math.round(totalPlayedSecondsRef.current))
onCompleteRef.current(isCorrect, durationSeconds)
```

---

### 4. 主页面 (page.tsx) 修改

**文件**: `/Users/a/dictation/src/app/page.tsx`

#### 更新 `handleComplete` 函数
**之前**：
```typescript
const handleComplete = async (
  sentenceId: number,
  isCorrect: boolean,
  usedShowWords: boolean = false,
  practiceMinutes?: number
)
```

**之后**：
```typescript
const handleComplete = async (
  sentenceId: number,
  isCorrect: boolean,
  usedShowWords: boolean = false,
  duration?: number  // Dictation: minutes, Shadowing: seconds
)
```

#### 数据保存逻辑
```typescript
await savePracticeRecord({
  // ... 其他字段
  durationSeconds: mode === 'shadowing' ? (duration || 0) : undefined,
})

// 更新统计数据
if (mode === 'dictation') {
  const minutes = duration || 0
  await onDictationComplete(user.id, minutes)
} else if (mode === 'shadowing') {
  const seconds = duration || 0
  const minutes = seconds / 60  // 转换为分钟
  await onShadowingComplete(user.id, minutes)
}
```

---

### 5. 统计查询逻辑修改

**文件**: `/Users/a/dictation/src/lib/supabase/streak.ts`

#### 更新 `getUserStats` 函数
从 `practice_records` 表计算真实的 Shadowing 总时间：

```typescript
export async function getUserStats(userId: string): Promise<UserStats | null> {
  // 获取 user_stats 表的数据
  const { data: statsData, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single()

  // 从 practice_records 表计算真实的 Shadowing 总时间（秒）
  const { data: shadowingTimeData } = await supabase
    .from('practice_records')
    .select('duration_seconds')
    .eq('user_id', userId)
    .eq('practice_mode', 'shadowing')

  // 累计所有 Shadowing 记录的 duration_seconds，转换为分钟
  const totalShadowingSeconds = (shadowingTimeData || [])
    .reduce((sum, record) => sum + (record.duration_seconds || 0), 0)

  const totalShadowingMinutes = Math.ceil(totalShadowingSeconds / 60)

  // 返回混合数据
  return {
    ...statsData,
    total_shadowing_minutes: totalShadowingMinutes,
  }
}
```

---

### 6. Profile 页面修改

**文件**: `/Users/a/dictation/src/app/profile/page.tsx`

#### 更新 `fetchUserData` 函数
从 `practice_records` 表计算今日的 Shadowing 时间：

```typescript
// 从 practice_records 计算今日的 Shadowing 时间
const today = new Date().toISOString().split('T')[0]
const { data: todayShadowingData } = await supabase
  .from('practice_records')
  .select('duration_seconds')
  .eq('user_id', user.id)
  .eq('practice_mode', 'shadowing')
  .gte('completed_at', today)

const todayShadowingSeconds = (todayShadowingData || [])
  .reduce((sum, record) => sum + (record.duration_seconds || 0), 0)
const todayShadowingMinutes = Math.ceil(todayShadowingSeconds / 60)

setTodayRecord({
  dictation_count: completeProfile.todayRecord.dictation_count || 0,
  shadowing_minutes: todayShadowingMinutes,  // 使用计算出的真实时间
  completed: completeProfile.todayRecord.completed || false,
})
```

---

## 执行步骤

### 1. 执行数据库迁移

在 Supabase Dashboard → SQL Editor 中执行：

```sql
-- 添加真实播放时长字段（秒）
ALTER TABLE public.practice_records
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

COMMENT ON COLUMN public.practice_records.duration_seconds IS '实际音频播放时长（秒），用于 Shadowing 等需要真实播放时间的练习模式';

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_practice_records_duration ON public.practice_records(user_id, practice_mode, duration_seconds);
```

### 2. 重新部署代码

```bash
# 如果使用 GitHub Actions，推送代码即可
git add .
git commit -m "feat: Shadowing 真实播放时间统计"
git push

# 等待 GitHub Actions 部署完成
```

### 3. 测试验证

1. 打开首页，切换到 Shadowing 模式
2. 点击播放原音，观察控制台输出：
   ```
   Audio paused. Total played: X.XXs
   Audio ended. Total played: X.XXs
   ```
3. 完成语音识别后，查看控制台：
   ```
   ShadowingPanel - Calling onComplete: {
     isCorrect: true/false,
     durationSeconds: X,
     totalPlayedSeconds: X.XX,
     sentenceId: X,
     sentenceText: "..."
   }
   ```
4. 进入 Profile 页面，检查 Shadowing 统计：
   - 总时间 = 所有练习的 duration_seconds 之和 / 60（向上取整）
   - 今日时间 = 今日练习的 duration_seconds 之和 / 60（向上取整）

---

## 兜底逻辑

如果无法获取精确播放时间，系统使用以下优先级：

1. **真实播放时间**（推荐）：监听 audio 元素的 play/pause/timeupdate 事件
2. **录音时间**：已实现（`practiceStartTime` → 语音识别完成）
3. **页面停留时间**：最后的选择

当前实现使用优先级 1（真实播放时间）。

---

## 注意事项

1. **向后兼容**：
   - `duration_seconds` 字段有默认值 0，不影响现有数据
   - 旧数据（无 duration_seconds）会被视为 0 秒

2. **性能优化**：
   - 创建了索引 `idx_practice_records_duration` 优化查询
   - 建议在数据量大时实现分页或缓存

3. **数据一致性**：
   - `user_stats.total_shadowing_minutes` 现在是从 `practice_records` 计算得出
   - 不再手动更新此字段，避免数据不一致

4. **测试建议**：
   - 测试重复播放同一句的情况
   - 测试暂停后继续播放的情况
   - 测试播放多句的累计时间
   - 验证 Profile 页面显示的总时间是否正确

---

## 相关文件清单

### 新增文件
- `/Users/a/dictation/supabase/migrations/add_duration_seconds.sql`

### 修改文件
- `/Users/a/dictation/src/lib/supabase/client.ts`
- `/Users/a/dictation/src/components/ShadowingPanel.tsx`
- `/Users/a/dictation/src/app/page.tsx`
- `/Users/a/dictation/src/lib/supabase/streak.ts`
- `/Users/a/dictation/src/app/profile/page.tsx`

---

## 修复的 bug

同时修复了 RPC 函数中的列名错误：
- `WHERE id = p_user_id` → `WHERE user_id = p_user_id`

这导致之前的 Dictation 和 Shadowing 统计都无法更新。

---

## 联系方式

如有问题，请检查：
1. 浏览器控制台的错误信息
2. Supabase Dashboard 的数据库日志
3. GitHub Actions 的构建日志
