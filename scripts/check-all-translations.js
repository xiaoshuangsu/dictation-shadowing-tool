/**
 * 检查所有素材的翻译质量
 * 检测口语化、方言、错乱等问题
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 口语化检测规则
 */
const colloquialPatterns = {
  // 极度口语化（应该完全避免）
  severe: [
    /这档子事儿/g,
    /啥的/g,
    /聚一块儿/g,
    /热闹热闹/g,
    /大伙儿/g,
    /咱们/g,
    /挺.+的/g,
    /.+呢$/gm, // 句末"呢"
    /.+啊$/gm, // 句末"啊"
    /.+呗$/gm, // 句末"呗"
    /逛逛/g,
    /玩玩/g,
    /来.+吧/g,
    /比一比/g,
    /最棒/g,
    /开头/g,
    /乡下人/g,
    /没几个/g,
    /大伙/g,
    /现在啊/g,
  ],

  // 中度口语化（应该改进）
  moderate: [
    /都/g,
    /就是/g,
    /还有/g,
    /有/g,
    /是一个/g,
    /叫做/g,
    /人们/g,
    /据说是/g,
  ],

  // 方言/地域特色
  dialect: [
    /得.+了/g, // "得开了"、"得持续"
    /.+呗/g,
    /.+嘛/g,
    /儿化音/g, // 检测过度的"儿"字
  ],
}

/**
 * 检查单个句子的翻译质量
 */
function checkTranslationQuality(english, chinese, index) {
  const issues = []

  if (!chinese) {
    issues.push({
      type: 'missing',
      severity: 'high',
      message: '缺少翻译'
    })
    return issues
  }

  // 检查极度口语化
  colloquialPatterns.severe.forEach(pattern => {
    if (pattern.test(chinese)) {
      const match = chinese.match(pattern)
      issues.push({
        type: 'severe_colloquial',
        severity: 'high',
        message: `极度口语化: "${match[0]}"`
      })
    }
  })

  // 检查重复词汇（超过3次）
  const words = chinese.split(/[^省市区地]/)
  const wordCount = {}
  words.forEach(w => {
    if (w && w.length > 2) {
      wordCount[w] = (wordCount[w] || 0) + 1
    }
  })

  Object.entries(wordCount).forEach(([word, count]) => {
    if (count > 3) {
      issues.push({
        type: 'repetition',
        severity: 'medium',
        message: `"${word}" 重复 ${count} 次`
      })
    }
  })

  // 检查过度的"是"字
  const isCount = (chinese.match(/是/g) || []).length
  if (isCount > 3) {
    issues.push({
      type: 'excessive_is',
      severity: 'low',
      message: `"是" 字出现 ${isCount} 次，建议优化`
    })
  }

  // 检查过度的"有"字
  const haveCount = (chinese.match(/有/g) || []).length
  if (haveCount > 4) {
    issues.push({
      type: 'excessive_have',
      severity: 'low',
      message: `"有" 字出现 ${haveCount} 次，建议优化`
    })
  }

  // 检查是否过短（可能翻译不完整）
  if (chinese.length < english.length * 0.3) {
    issues.push({
      type: 'too_short',
      severity: 'medium',
      message: `翻译可能不完整 (中文${chinese.length}字 vs 英文${english.length}字)`
    })
  }

  return issues
}

/**
 * 主检查函数
 */
async function checkAllTranslations() {
  try {
    console.log('📖 Loading all materials from database...\n')

    const { data: materials, error } = await supabase
      .from('materials')
      .select('title, transcript')

    if (error) throw error

    console.log(`✅ Found ${materials.length} materials\n`)
    console.log('='.repeat(80))
    console.log('🔍 Translation Quality Report')
    console.log('='.repeat(80) + '\n')

    const results = []

    for (const material of materials) {
      if (!material.transcript || material.transcript.length === 0) {
        continue
      }

      let totalSentences = 0
      let missingTranslations = 0
      let severeIssues = 0
      let mediumIssues = 0
      const problemSentences = []

      material.transcript.forEach((sentence, index) => {
        if (!sentence.text) return

        totalSentences++
        const issues = checkTranslationQuality(sentence.text, sentence.translation, index)

        if (issues.length === 0) return

        issues.forEach(issue => {
          if (issue.type === 'missing') {
            missingTranslations++
          } else if (issue.severity === 'high') {
            severeIssues++
          } else if (issue.severity === 'medium') {
            mediumIssues++
          }
        })

        if (issues.some(i => i.severity === 'high')) {
          problemSentences.push({
            index: index + 1,
            english: sentence.text.substring(0, 60),
            chinese: sentence.translation,
            issues: issues.filter(i => i.severity === 'high')
          })
        }
      })

      results.push({
        title: material.title,
        total: totalSentences,
        missing: missingTranslations,
        severe: severeIssues,
        medium: mediumIssues,
        problems: problemSentences.slice(0, 5) // 只显示前5个问题句子
      })
    }

    // 按严重程度排序
    results.sort((a, b) => b.severe - a.severe || b.missing - a.missing)

    // 显示报告
    results.forEach((result, idx) => {
      if (result.severe === 0 && result.missing === 0) {
        console.log(`[${idx + 1}] ✅ ${result.title}`)
        console.log(`    翻译质量良好，共 ${result.total} 句\n`)
        return
      }

      const hasSevere = result.severe > 0
      const hasMissing = result.missing > 0

      console.log(`[${idx + 1}] ${hasSevere || hasMissing ? '⚠️' : '✅'} ${result.title}`)
      console.log(`    总句数: ${result.total} | 缺失: ${result.missing} | 严重问题: ${result.severe} | 中度问题: ${result.medium}`)

      if (result.problems.length > 0) {
        console.log('    问题示例:')
        result.problems.forEach(p => {
          console.log(`      [句${p.index}] ${p.english}...`)
          console.log(`        当前: ${p.chinese}`)
          p.issues.forEach(issue => {
            console.log(`        ⚠️  ${issue.message}`)
          })
          console.log('')
        })
      } else {
        console.log('')
      }
    })

    // 总结
    console.log('='.repeat(80))
    console.log('📊 Summary')
    console.log('='.repeat(80))

    const needsWork = results.filter(r => r.severe > 0 || r.missing > 0)
    const good = results.filter(r => r.severe === 0 && r.missing === 0)

    console.log(`总素材数: ${results.length}`)
    console.log(`✅ 翻译良好: ${good.length}`)
    console.log(`⚠️  需要改进: ${needsWork.length}`)

    if (needsWork.length > 0) {
      console.log('\n🔴 需要优先处理的素材:')
      needsWork.slice(0, 5).forEach(r => {
        console.log(`  - ${r.title} (${r.severe + r.missing} 个问题)`)
      })

      console.log('\n💡 建议优先处理这些素材的翻译问题')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the checker
checkAllTranslations()
