# 统计联动测试指南

## 测试目的
验证生词页面重构后的统计联动功能：
- ✅ 用户在闪卡背面点击按钮时，数据库中的 `next_review_at` 正确更新
- ✅ 统计组件的 Reviewed 计数和 Progress 进度条自动刷新
- ✅ Due Today 和 Accuracy 正确计算

## 测试步骤

### 1. 启动开发服务器
```bash
npm run dev
# 服务器已启动在 http://localhost:3000
```

### 2. 访问首页并记录初始数值
1. 打开浏览器访问：http://localhost:3000/vocabulary
2. 打开浏览器控制台（F12 或 Cmd+Option+I）
3. 记录右侧数据面板的初始数值：
   - **Due Today**: ___ 个单词
   - **Reviewed**: ___ 个单词
   - **Accuracy**: ___%
   - **Streak**: ___ 天

### 3. 执行复习操作
1. 点击 "Start Reviewing" 按钮（或直接访问 http://localhost:3000/vocabulary/my-words）
2. 在单词列表中，点击任意单词卡片打开闪卡
3. 在闪卡背面，点击任意自评按钮：
   - 😵 Still Learning（1 小时后复习）
   - 🤔 Kinda Know（1 天后复习）
   - 😎 Too Easy（7 天后复习）

### 4. 观察控制台日志
在浏览器控制台中，你应该看到以下日志：

```
[ReviewOverlay] 🔄 触发统计数据重新验证
[Stats API] 📊 获取用户统计: { userId: '...' }
[Stats API] ✅ 统计数据: { dueWords: X, reviewed: Y, accuracy: Z, streak: N }
```

### 5. 验证数据自动更新
**关键步骤：不要手动刷新页面！**

1. 点击浏览器的"返回"按钮回到首页（或点击 "Vocabulary Learning Hub"）
2. **观察右侧数据面板的数值是否自动更新：**
   - Reviewed 应该 +1（例如从 8 变成 9）
   - Progress 进度条应该自动增长
   - 无需手动刷新页面！

### 6. 验证 API 响应
你也可以直接在浏览器中访问 API 来查看数据：
```
http://localhost:3000/api/user-words/stats
```
（注意：需要带上 Authorization header，这个只能在控制台中测试）

在控制台中执行：
```javascript
fetch('/api/user-words/stats', {
  headers: {
    'Authorization': 'Bearer ' + (await supabase.auth.getUser()).data.user.id
  }
}).then(r => r.json()).then(console.log)
```

## 预期结果

### ✅ 成功标志
- [ ] 控制台显示 `[Stats API] ✅ 统计数据:` 日志
- [ ] Reviewed 计数自动 +1
- [ ] Progress 进度条自动增长
- [ ] 无需手动刷新页面

### ❌ 失败标志
- [ ] 控制台显示 `[Stats API] ❌ 错误:` 日志
- [ ] Reviewed 计数不变
- [ ] 需要手动刷新页面才能看到更新
- [ ] 统计数据显示为 0 或错误值

## 技术细节

### 数据计算规则
1. **Due Today**: 统计 `next_review_at <= now` 的单词数量
2. **Reviewed**: 统计今天已更新的单词数量（`updated_at >= 今天 00:00`）
3. **Accuracy**: 根据掌握状态计算（mastered=100%, familiar=50%, learning=0%）
4. **Streak**: 从 `user_profiles.current_streak` 获取

### SWR 缓存策略
- 缓存时间：10 秒内相同请求自动去重
- 自动刷新：复习完成后触发 `mutate()` 全局重新验证
- 手动刷新：关闭 `revalidateOnFocus` 和 `revalidateOnReconnect`

### API 响应格式
```json
{
  "success": true,
  "stats": {
    "dueWords": 15,
    "reviewed": 9,
    "accuracy": 75,
    "streak": 7
  }
}
```

## 故障排查

### 问题 1: Reviewed 计数不变
**原因**: 可能是时区问题，`updated_at` 不是今天
**解决**: 检查数据库中的 `updated_at` 字段是否为今天

### 问题 2: 控制台无日志
**原因**: 开发服务器未启动或代码未编译
**解决**: 检查 `npm run dev` 是否正在运行

### 问题 3: API 返回 401
**原因**: 用户未登录或 token 过期
**解决**: 重新登录网站

## 提交前检查清单

- [ ] 本地测试通过：Reviewed 自动 +1
- [ ] 控制台日志正常：无错误信息
- [ ] 无需手动刷新：数据自动更新
- [ ] 多次测试：连续复习 3-5 个单词，统计持续更新

---
**测试日期**: 2026-04-09
**版本**: V30.0.3
