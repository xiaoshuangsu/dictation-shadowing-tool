# 🔥 火焰动画测试指南

## 测试目的
验证 Streak 火焰动画效果：
- ✅ 未达标（Reviewed < 20）：火焰图标为灰色
- ✅ 已达标（Reviewed >= 20）：火焰图标变橙色，跳动燃烧效果

## 本地测试步骤

### 方法一：修改 API 模拟数据（快速测试）

1. **修改 API 添加临时 mock 数据**：

   打开 `src/app/api/user-words/stats/route.ts`，临时修改为：
   ```typescript
   const stats = {
     dueWords,
     reviewed: 20, // 👈 强制设置为 20，测试火焰动画
     accuracy,
     streak,
     goalAchieved: true,  // 👈 强制达成目标
     dailyGoal: DAILY_GOAL
   }
   ```

2. **观察效果**：
   - 刷新浏览器 http://localhost:3000/vocabulary
   - 观察 Streak 卡片的火焰图标：
     - 颜色：橙色 🔥
     - 动画：跳动（Pulse）+ 发光（Glow）
     - 右上角：🔥 emoji

3. **恢复未达标状态**：
   - 修改 `reviewed: 19`，`goalAchieved: false`
   - 刷新浏览器
   - 确认火焰图标变回灰色

### 方法二：实际复习测试（真实场景）

1. **打开首页**：http://localhost:3000/vocabulary
2. **记录当前 Reviewed 数值**：例如 5
3. **进行复习**：
   - 点击 "Start Reviewing"
   - 连续复习单词，直到 Reviewed 达到 20
4. **返回首页**：
   - 观察火焰图标自动变为橙色，开始跳动
   - 右上角出现 🔥 emoji

## 预期动画效果

### 未达标状态（Reviewed < 20）
```
🔥 灰色火焰图标
无动画
无 emoji
```

### 已达标状态（Reviewed >= 20）
```
🔥 橙色火焰图标
✨ 跳动效果（Scale: 1 → 1.2 → 1）
✨ 发光效果（Glow Shadow）
✨ 右上角 🔥 emoji（Pulse 动画）
```

### 动画细节
- **跳动频率**：1.5 秒一个周期
- **缩放范围**：1.0 → 1.2 → 1.0
- **发光效果**：多层阴影（橙色+红色）
- **亮度增强**：brightness 1.0 → 1.3

## 技术实现

### CSS 动画
```css
@keyframes fire-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes fire-glow {
  0%, 100% {
    filter: drop-shadow(0 0 2px rgba(249, 115, 22, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(234, 88, 12, 0.8));
  }
}
```

### React 组件
```tsx
<Flame
  className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${
    isFireActive
      ? 'text-orange-500 animate-fire-pulse'
      : 'text-gray-400'
  }`}
/>
```

## 验证清单

测试完成后，请确认：
- [ ] Reviewed < 20 时，火焰为灰色
- [ ] Reviewed >= 20 时，火焰变橙色
- [ ] 火焰图标有跳动效果
- [ ] 火焰图标有发光效果
- [ ] 右上角显示 🔥 emoji
- [ ] 动画流畅，无卡顿

---
**测试日期**：2026-04-09
**版本**：V30.0.3
**每日目标**：20 个单词
