#!/usr/bin/env node
/**
 * 批量优化翻译脚本（使用智谱 GLM-4）
 *
 * 功能：
 * - 从数据库获取所有已有翻译的句子
 * - 使用智谱 GLM-4 优化翻译，使其更地道、口语化
 * - 批量更新数据库中的 translation 字段
 * - 输出优化前后对比
 *
 * 使用方法：
 *   node scripts/refine_translations.js
 *   npm run refine-translations
 *
 * 环境变量：
 *   GLM_API_KEY - 智谱 AI API 密钥
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key
 *
 * 获取 API Key: https://open.bigmodel.cn/usercenter/apikeys
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// 从环境变量加载配置
const GLM_API_KEY = process.env.GLM_API_KEY

// 智谱 GLM API 配置
const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

// Supabase 配置
const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// 验证配置
if (!GLM_API_KEY) {
  console.error('❌ 错误: 未找到 GLM_API_KEY 环境变量')
  console.error('\n请先设置智谱 API 密钥:')
  console.error('  1. 访问 https://open.bigmodel.cn/usercenter/apikeys')
  console.error('  2. 创建或复制你的 API Key')
  console.error('  3. 设置环境变量:')
  console.error('     export GLM_API_KEY=your-key-here')
  process.exit(1)
}

if (!SUPABASE_KEY) {
  console.error('❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  console.error('\n请先设置 Supabase Service Role Key:')
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=your-key-here')
  process.exit(1)
}

// 创建 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 优化单条翻译
 */
async function refineTranslation(originalText, currentTranslation, context = '') {
  const systemPrompt = `你是一位雅思口语专家和资深翻译。你的任务是将英文句子翻译成最地道的中文口语。

要求：
1. 口语优先：使用生活化的表达，避免书面语
2. 去翻译腔：不要使用"被"、"使得"、"它是...的"等机翻痕迹
3. 自然流畅：让中国学生听起来觉得自然、地道
4. 语境适配：${context ? `这句话来自"${context}"，请根据场景调整语气` : '这是日常对话场景'}

输出格式：只返回翻译后的中文，不要有任何解释。`

  const userPrompt = `英文原文：${originalText}
当前翻译：${currentTranslation}

请优化这个翻译，使其更地道、更口语化：`

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.4,  // 稍微提高创造性
        max_tokens: 500,
        top_p: 0.8
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

    const refinedTranslation = data.choices[0].message.content.trim()

    return refinedTranslation
  } catch (error) {
    console.error('❌ 翻译优化失败:', error.message)
    throw error
  }
}

/**
 * 优化单个素材的所有句子
 */
async function refineMaterial(material) {
  console.log(`\n📝 正在优化: ${material.title}`)
  console.log(`   ID: ${material.id}`)
  console.log(`   句子数: ${material.transcript.length}`)

  // 找出有翻译的句子
  const sentencesToRefine = material.transcript.filter(s => s.translation)
  const totalToRefine = sentencesToRefine.length

  if (totalToRefine === 0) {
    console.log(`   ✅ 没有需要优化的翻译`)
    return { success: true, refined: 0, comparisons: [] }
  }

  console.log(`   需要优化: ${totalToRefine} 个句子`)

  // 批量优化（每次最多 5 个句子，控制质量和速率）
  const batchSize = 5
  let refinedCount = 0
  const comparisons = []  // 存储优化前后的对比

  for (let i = 0; i < sentencesToRefine.length; i += batchSize) {
    const batch = sentencesToRefine.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(sentencesToRefine.length / batchSize)

    console.log(`   批次 ${batchNumber}/${totalBatches}: 优化 ${batch.length} 个句子...`)

    try {
      // 逐个优化（保证质量）
      for (const sentence of batch) {
        const originalTranslation = sentence.translation
        const refined = await refineTranslation(
          sentence.text,
          originalTranslation,
          material.title
        )

        // 更新句子的翻译
        sentence.translation = refined
        refinedCount++

        // 存储对比（随机采样，总共最多 10 条）
        if (comparisons.length < 10 && Math.random() < 0.1) {
          comparisons.push({
            text: sentence.text,
            before: originalTranslation,
            after: refined
          })
        }

        // 避免触发 API 速率限制
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      console.log(`   ✅ 批次 ${batchNumber}/${totalBatches} 完成`)

      // 批次间休息
      if (i + batchSize < sentencesToRefine.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`   ❌ 批次 ${batchNumber} 优化失败:`, error.message)
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

    console.log(`   ✅ 已保存到数据库 (优化了 ${refinedCount} 个句子)`)
    return { success: true, refined: refinedCount, comparisons }
  } catch (error) {
    console.error(`   ❌ 保存到数据库失败:`, error.message)
    throw error
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始批量优化翻译...\n')

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

    // 筛选有翻译的素材
    const materialsToRefine = materials.filter(material => {
      if (!material.transcript || material.transcript.length === 0) {
        return false
      }
      // 检查是否有翻译
      return material.transcript.some(s => s.translation)
    })

    console.log(`📊 需要优化的素材: ${materialsToRefine.length} 个`)

    let totalRefined = 0
    let successCount = 0
    let failCount = 0
    const allComparisons = []  // 收集所有对比

    // 逐个优化素材
    for (const material of materialsToRefine) {
      try {
        const result = await refineMaterial(material)
        if (result.success) {
          successCount++
          totalRefined += result.refined
          allComparisons.push(...result.comparisons)
        }
      } catch (error) {
        console.error(`❌ 优化素材 ${material.title} 失败:`, error.message)
        failCount++
      }
    }

    // 输出统计
    console.log('\n' + '='.repeat(60))
    console.log('📊 优化完成统计:')
    console.log(`   处理素材: ${materialsToRefine.length}`)
    console.log(`   成功: ${successCount}`)
    console.log(`   失败: ${failCount}`)
    console.log(`   总优化句子: ${totalRefined}`)
    console.log('='.repeat(60))

    // 输出优化前后对比（最多 10 条）
    if (allComparisons.length > 0) {
      const sampleCount = Math.min(10, allComparisons.length)
      const sample = allComparisons.slice(0, sampleCount)

      console.log('\n📝 优化前后对比（随机 10 条）:\n')
      sample.forEach((comp, index) => {
        console.log(`${index + 1}. 英文原文:`)
        console.log(`   ${comp.text}`)
        console.log(`   优化前: ${comp.before}`)
        console.log(`   优化后: ${comp.after}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('\n❌ 优化过程出错:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main()
