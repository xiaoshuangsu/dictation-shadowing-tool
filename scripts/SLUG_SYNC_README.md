# 素材 Slug 同步

## 问题描述

`src/lib/data/materialSlugs.ts` 文件用于在静态导出时预定义所有素材的 slug。如果手动维护该文件，容易出现 slug 与完整标题不一致的问题，导致 GitHub Pages 404。

## 解决方案

使用自动化脚本 `scripts/sync-slugs.js` 从 Supabase 数据库同步所有素材的 slug。

## 使用方法

### 添加新素材后运行

```bash
npm run sync-slugs
```

### 脚本功能

1. 从 Supabase 获取所有素材的标题
2. 使用 `titleToSlug` 函数生成完整的 slug
3. 自动更新 `src/lib/data/materialSlugs.ts` 文件
4. 验证是否有重复的 slug

### 工作流程

1. **添加新素材到数据库**（通过 Python 脚本或其他方式）
2. **运行同步脚本**：`npm run sync-slugs`
3. **提交更改**：`git add . && git commit -m "..." && git push`
4. **GitHub Pages 自动部署**

## 注意事项

- ⚠️ **不要手动编辑** `src/lib/data/materialSlugs.ts` 文件
- 每次添加/删除/重命名素材后都要运行 `npm run sync-slugs`
- 在 `git push` 之前运行该脚本，确保 GitHub Pages 不会 404

## 技术说明

Next.js 静态导出需要预定义所有动态路由的参数。`generateStaticParams` 函数使用 `MATERIAL_SLUGS` 数组来预渲染所有素材页面。

如果 slug 不在数组中，Next.js 不会预渲染该页面，导致 GitHub Pages 404。
