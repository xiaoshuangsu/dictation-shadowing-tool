/**
 * 批量修复所有素材中的口语化翻译
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 口语化词汇替换规则
 */
const colloquialReplacements = [
  // 第一人称代词
  ['咱们', '我们'],
  ['咱', '我们'],

  // 程度副词 - 过度使用"挺"
  ['挺不错的', '很好的'],
  ['挺好看的', '美观的'],
  ['挺重要的', '重要的'],
  ['挺大的', '很大的'],
  ['挺多的', '许多'],
  ['挺常见的', '常见的'],
  ['挺成功的', '成功的'],
  ['挺厉害的', '出色的'],
  ['挺合适的', '合适的'],
  ['挺方便的', '便利的'],
  ['挺容易的', '容易的'],
  ['挺困难的', '困难的'],
  ['挺长的', '漫长的'],
  ['挺高的', '很高的'],
  ['挺远的', '遥远的'],
  ['挺近的', '接近的'],
  ['挺快的', '快速的'],
  ['挺慢的', '缓慢的'],
  ['挺热闹的', '热闹的'],
  ['挺开心的', '开心的'],
  ['挺幸运的', '幸运的'],
  ['挺有意思的', '有趣的'],
  ['挺刺激的', '刺激的'],
  ['挺酷的', '很酷的'],
  ['挺棒的', '很棒的'],
  ['挺聪明的', '聪明的'],
  ['挺勇敢的', '勇敢的'],
  ['挺友好的', '友好的'],
  ['挺可爱的', '可爱的'],
  ['挺美丽的', '美丽的'],
  ['挺壮观的', '壮观的'],
  ['挺神奇的', '神奇的'],
  ['挺神秘的', '神秘的'],
  ['挺危险的', '危险的'],
  ['挺安全的', '安全的'],
  ['挺健康的', '健康的'],
  ['挺强壮的', '强壮的'],
  ['挺瘦弱的', '瘦弱的'],
  ['挺胖的', '肥胖的'],
  ['挺高的', '高大的'],
  ['挺矮的', '矮小的'],
  ['挺年轻的', '年轻的'],
  ['挺老的', '年长的'],
  ['挺新的', '崭新的'],
  ['挺旧的', '陈旧的'],
  ['挺干净的', '干净的'],
  ['挺脏的', '肮脏的'],
  ['挺亮的', '明亮的'],
  ['挺暗的', '昏暗的'],
  ['挺暖和的', '温暖的'],
  ['挺冷的', '寒冷的'],
  ['挺热的', '炎热的'],
  ['挺干的', '干燥的'],
  ['挺湿的', '潮湿的'],
  ['挺硬的', '坚硬的'],
  ['挺软的', '柔软的'],
  ['挺光滑的', '光滑的'],
  ['挺粗糙的', '粗糙的'],
  ['挺锋利的', '锋利的'],
  ['挺钝的', '钝的'],
  ['挺尖的', '尖锐的'],
  ['挺圆的', '圆形的'],
  ['挺方的', '方形的'],
  ['挺直的', '笔直的'],
  ['挺弯的', '弯曲的'],
  ['挺平的', '平坦的'],
  ['挺陡的', '陡峭的'],
  ['挺深的', '深的'],
  ['挺浅的', '浅的'],
  ['挺宽的', '宽阔的'],
  ['挺窄的', '狭窄的'],
  ['挺厚的', '厚的'],
  ['挺薄的', '薄的'],
  ['挺重的', '沉重的'],
  ['挺轻的', '轻盈的'],
  ['挺甜的', '甜的'],
  ['挺苦的', '苦的'],
  ['挺酸的', '酸的'],
  ['挺辣的', '辣的'],
  ['挺咸的', '咸的'],
  ['挺香的', '香的'],
  ['挺臭的', '臭的'],

  // 其他口语化词汇
  ['啥的', '等'],
  ['啥', '什么'],
  ['这档子事儿', '这件事'],
  ['大伙儿', '大家'],
  ['大伙', '大家'],
  ['聚一块儿', '聚集'],
  ['聚一块', '聚集'],
  ['热闹热闹', '庆祝'],
  ['比一比', '比较'],
  ['最棒的', '最佳的'],
  ['最棒', '最佳'],
  ['玩玩', '参与'],
  ['来.+吧', '欢迎'], // "来逛逛吧" → "欢迎"

  // 方言/句末语气词
  ['呢$', ''],
  ['啊$', ''],
  ['呗$', ''],
  ['嘛$', ''],

  // 其他优化
  ['有点儿', '有些'],
  ['有点', '有些'],
  ['好多', '许多'],
  ['好几个', '若干'],
  ['好多好几个', '许多'],
]

/**
 * 应用替换规则到单个翻译
 */
function applyReplacements(text) {
  if (!text) return text

  let result = text

  colloquialReplacements.forEach(([old, newStr]) => {
    // 使用正则进行全局替换
    const pattern = new RegExp(old, 'g')
    result = result.replace(pattern, newStr)
  })

  return result
}

/**
 * 批量修复所有素材
 */
async function fixAllMaterials() {
  try {
    console.log('📖 Loading all materials from database...\n')

    const { data: materials, error } = await supabase
      .from('materials')
      .select('title, transcript')

    if (error) throw error

    console.log(`✅ Found ${materials.length} materials\n`)
    console.log('🔧 Applying colloquial fixes...\n')

    let totalFixed = 0
    let totalSentences = 0

    for (const material of materials) {
      if (!material.transcript || material.transcript.length === 0) continue

      let materialFixed = 0
      const updatedTranscript = material.transcript.map(sentence => {
        if (!sentence.translation) return sentence

        totalSentences++
        const originalTranslation = sentence.translation
        const fixedTranslation = applyReplacements(originalTranslation)

        if (fixedTranslation !== originalTranslation) {
          materialFixed++
          totalFixed++
          return {
            ...sentence,
            translation: fixedTranslation
          }
        }

        return sentence
      })

      if (materialFixed > 0) {
        console.log(`[${material.title}]`)
        console.log(`  Fixed: ${materialFixed} sentences`)

        // 保存到数据库
        const { error: updateError } = await supabase
          .from('materials')
          .update({ transcript: updatedTranscript })
          .eq('title', material.title)

        if (updateError) {
          console.log(`  ⚠️  Failed to save: ${updateError.message}`)
        } else {
          console.log(`  ✅ Saved\n`)
        }
      }
    }

    console.log('='.repeat(70))
    console.log('📊 Summary')
    console.log('='.repeat(70))
    console.log(`Total sentences processed: ${totalSentences}`)
    console.log(`Total fixes applied: ${totalFixed}`)
    console.log('✅ All materials updated!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the fixer
fixAllMaterials()
