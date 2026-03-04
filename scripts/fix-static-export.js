#!/usr/bin/env node
/**
 * 修复 Next.js 静态导出的路径问题
 *
 * Next.js 静态导出生成 topics.html 而不是 topics/index.html
 * 这个脚本将嵌套路径的 .html 文件复制到对应的 index.html
 *
 * 在 package.json 的 postbuild 中运行此脚本
 */

const fs = require('fs')
const path = require('path')

function fixStaticExport() {
  const outDir = path.join(process.cwd(), 'out')

  if (!fs.existsSync(outDir)) {
    console.log('⚠️  out 目录不存在，跳过')
    return
  }

  console.log('🔧 修复静态导出路径...')

  // 查找所有需要创建 index.html 的路径
  const files = fs.readdirSync(outDir)
  let fixedCount = 0

  files.forEach(file => {
    const filePath = path.join(outDir, file)

    // 跳过目录和已有 index.html 的目录
    if (fs.statSync(filePath).isDirectory()) {
      return
    }

    // 处理类似 topics.html 的文件
    // 条件：是 .html 文件，不是 index.html，且文件名中只有一个点（.html）
    if (file.endsWith('.html') && file !== 'index.html') {
      // 检查是否只有一个点（在 .html 之前）
      const dotCount = (file.match(/\./g) || []).length
      if (dotCount === 1) {
        const dirName = file.replace('.html', '')
        const dirPath = path.join(outDir, dirName)

        // 创建目录
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true })
        }

        const indexHtmlPath = path.join(dirPath, 'index.html')
        const fileContent = fs.readFileSync(filePath, 'utf8')

        // 写入 index.html
        fs.writeFileSync(indexHtmlPath, fileContent, 'utf8')
        fixedCount++
        console.log(`  ✅ 创建 ${dirName}/index.html`)
      }
    }
  })

  console.log(`✅ 完成！修复了 ${fixedCount} 个路径`)

  // 删除 test-mobile 目录（仅用于开发调试）
  const testMobilePath = path.join(outDir, 'test-mobile')
  if (fs.existsSync(testMobilePath)) {
    fs.rmSync(testMobilePath, { recursive: true, force: true })
    console.log('🗑️  删除 test-mobile 目录')
  }
}

fixStaticExport()
