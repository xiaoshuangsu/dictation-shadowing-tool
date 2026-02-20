#!/usr/bin/env node
/**
 * 自动翻译脚本（使用智谱 GLM-4）
 *
 * 功能：
 * - 遍历数据库中所有素材
 * - 为没有 translation 字段的句子添加中文翻译
 * - 使用智谱 GLM-4 API 进行翻译
 *
 * 使用方法：
 *   node scripts/translate.js
 *   npm run translate-all
 *   npm run translate-new
 *
 * 环境变量：
 *   GLM_API_KEY - 智谱 AI API 密钥
 *
 * 获取 API Key: https://open.bigmodel.cn/usercenter/apikeys
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 从环境变量加载配置
const GLM_API_KEY = process.env.GLM_API_KEY

// 智谱 GLM API 配置
const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

// Supabase 配置
const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
// 使用 service_role key 以获得写入权限
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_KEY) {
  console.error('❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  process.exit(1)
}

// 命令行参数
const args = process.argv.slice(2)
const isNewOnly = args.includes('--new') || args.includes('-n')

// 验证配置
if (!GLM_API_KEY) {
  console.error('❌ 错误: 未找到 GLM_API_KEY 环境变量')
  console.error('\n请先设置智谱 API 密钥:')
  console.error('  1. 访问 https://open.bigmodel.cn/usercenter/apikeys')
  console.error('  2. 创建或复制你的 API Key')
  console.error('  3. 设置环境变量:')
  console.error('     export GLM_API_KEY=your-key-here')
  console.error('  或创建 .env.local 文件添加: GLM_API_KEY=your-key-here')
  process.exit(1)
}

// 创建 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 调用智谱 GLM API 进行翻译
 */
async function translateWithGLM(texts) {
  try {
    const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的英汉翻译助手。请将以下英文句子翻译成简洁自然的中文，只返回翻译结果，不要有任何解释。每行一个翻译，按顺序对应。'
          },
          {
            role: 'user',
            content: `请将以下 ${texts.length} 个英文句子翻译成中文，每行一个翻译，按顺序对应：\n${texts.join('\n')}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        top_p: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GLM API 请求失败: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`GLM API 错误: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const translatedText = data.choices[0].message.content.trim()

    // 解析翻译结果（每行一个）
    const translations = translatedText.split('\n').map(line => line.trim()).filter(line => line)

    if (translations.length !== texts.length) {
      console.warn(`⚠️  翻译数量不匹配: 期望 ${texts.length}，实际 ${translations.length}`)
    }

    return translations
  } catch (error) {
    console.error('❌ 翻译失败:', error.message)
    throw error
  }
}

/**
 * 翻译单个素材的所有句子
 */
async function translateMaterial(material) {
  console.log(`\n📝 正在翻译: ${material.title}`)
  console.log(`   ID: ${material.id}`)
  console.log(`   句子数: ${material.transcript.length}`)

  // 找出需要翻译的句子
  const sentencesToTranslate = material.transcript.filter(s => !s.translation)
  const totalToTranslate = sentencesToTranslate.length

  if (totalToTranslate === 0) {
    console.log(`   ✅ 所有句子已有翻译，跳过`)
    return { success: true, translated: 0 }
  }

  console.log(`   需要翻译: ${totalToTranslate} 个句子`)

  // 批量翻译（每次最多 10 个句子）
  const batchSize = 10
  let translatedCount = 0

  for (let i = 0; i < sentencesToTranslate.length; i += batchSize) {
    const batch = sentencesToTranslate.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(sentencesToTranslate.length / batchSize)

    console.log(`   批次 ${batchNumber}/${totalBatches}: 翻译 ${batch.length} 个句子...`)

    try {
      const texts = batch.map(s => s.text)
      const translations = await translateWithGLM(texts)

      // 更新句子的翻译
      for (let j = 0; j < batch.length; j++) {
        if (translations[j]) {
          batch[j].translation = translations[j]
        }
      }

      translatedCount += batch.length
      console.log(`   ✅ 批次 ${batchNumber}/${totalBatches} 完成`)

      // 避免触发 API 速率限制
      if (i + batchSize < sentencesToTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`   ❌ 批次 ${batchNumber} 翻译失败:`, error.message)
      throw error
    }
  }

  // 将更新后的 transcript 写回数据库
  try {
    const { error } = await supabase
      .from('materials')
      .update({ transcript: material.transcript })
      .eq('id', material.id)

    if (error) {
      throw error
    }

    console.log(`   ✅ 已保存到数据库 (翻译了 ${translatedCount} 个句子)`)
    return { success: true, translated: translatedCount }
  } catch (error) {
    console.error(`   ❌ 保存到数据库失败:`, error.message)
    throw error
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始自动翻译...\n')

  try {
    // 获取所有素材
    console.log('📥 正在从数据库获取素材...')
    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, title, transcript')

    if (error) {
      throw error
    }

    if (!materials || materials.length === 0) {
      console.log('数据库中没有素材')
      return
    }

    console.log(`✅ 找到 ${materials.length} 个素材\n`)

    // 筛选需要翻译的素材
    const materialsToTranslate = materials.filter(material => {
      if (!material.transcript || material.transcript.length === 0) {
        return false
      }

      // 如果是 --new 模式，只处理完全没有翻译的素材
      if (isNewOnly) {
        const hasAnyTranslation = material.transcript.some(s => s.translation)
        return !hasAnyTranslation
      }

      // 否则，处理所有有未翻译句子的素材
      const hasUntranslated = material.transcript.some(s => !s.translation)
      return hasUntranslated
    })

    console.log(`📊 需要翻译的素材: ${materialsToTranslate.length} 个`)
    if (isNewOnly) {
      console.log(`   模式: 仅翻译完全没有翻译的素材`)
    } else {
      console.log(`   模式: 翻译所有未翻译的句子`)
    }

    let totalTranslated = 0
    let successCount = 0
    let failCount = 0

    // 逐个翻译素材
    for (const material of materialsToTranslate) {
      try {
        const result = await translateMaterial(material)
        if (result.success) {
          successCount++
          totalTranslated += result.translated
        }
      } catch (error) {
        console.error(`❌ 翻译素材 ${material.title} 失败:`, error.message)
        failCount++
      }
    }

    // 输出统计
    console.log('\n' + '='.repeat(50))
    console.log('📊 翻译完成统计:')
    console.log(`   处理素材: ${materialsToTranslate.length}`)
    console.log(`   成功: ${successCount}`)
    console.log(`   失败: ${failCount}`)
    console.log(`   总翻译句子: ${totalTranslated}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n❌ 翻译过程出错:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main()
