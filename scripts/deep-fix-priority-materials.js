/**
 * 深度修复高优先级素材
 * 对问题最严重的素材进行完全重写和优化
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 高优先级素材的手动修正翻译
 * 针对最严重的口语化问题进行完全重写
 */
const priorityFixes = {
  // Bill Clinton Speech 1 - 关键段落完全重写
  "Bill Clinton: 'Second Inaugural Address' (1)": {
    1: {
      text: "My fellow citizens, at this last presidential inauguration of the 20th century, let us lift our eyes toward the challenges that await us in the next century.",
      translation: "同胞们，在20世纪最后一次总统就职典礼上，让我们展望下一个世纪等待我们的挑战。"
    },
    2: {
      text: "It is a moment of hope and we must seize it.",
      translation: "这是一个充满希望的时刻，我们必须把握住它。"
    },
    3: {
      text: "The promise of America was born in the 18th century, and we are now standing on the edge of a new frontier of human affairs.",
      translation: "美国的承诺诞生于18世纪，我们现在正站在人类事务新前沿的边缘。"
    },
    4: {
      text: "We must keep our old democracy forever young.",
      translation: "我们必须让我们古老的民主永远保持活力。"
    },
    5: {
      text: "Guided by the ancient vision of a promised land, let us set our sights upon a land of new promise.",
      translation: "在应许之地的古老愿景指引下，让我们将目光投向新的希望之地。"
    },
    // ... 更多句子可以根据需要添加
  },

  // Robert F. Kennedy Speech
  "Robert F. Kennedy: 'Speech after Assassination of Martin Luther King, Jr.'": {
    1: {
      text: "I have bad news for you, for all of our fellow citizens and people who love peace all over the world.",
      translation: "我要告诉大家一个坏消息，对我们所有的同胞以及全世界热爱和平的人们来说。"
    },
    2: {
      text: "Martin Luther King was shot and killed tonight in Memphis, Tennessee.",
      translation: "马丁·路德·金今晚在田纳西州孟菲斯市遇刺身亡。"
    },
    3: {
      text: "Martin Luther King dedicated his life to love and to justice for his fellow human beings, and he died because of that effort.",
      translation: "马丁·路德·金将他的一生奉献给对同胞的爱与正义事业，并因此献出了生命。"
    },
    4: {
      text: "In this difficult day, in this difficult time for the United States, it is perhaps well to ask what kind of a nation we are and what direction we want to move in.",
      translation: "在这个对美国来说艰难的日子，在这个艰难时刻，也许我们应该思考一下，我们要成为一个什么样的国家，我们要向什么方向前进。"
    },
    // ... 更多句子
  },

  // John F. Kennedy Speech
  "John F. Kennedy: 'Ich bin ein Berliner'": {
    1: {
      text: "Two thousand years ago, the proudest boast was 'Civis Romanus sum'. Today, in the world of freedom, the proudest boast is 'Ich bin ein Berliner'.",
      translation: '两千年前，最自豪的宣言是"我是罗马公民"。今天，在自由世界里，最自豪的宣言是"我是柏林人"。'
    },
    2: {
      text: "There are many people in the world who really don't understand, or say they don't, what is the great issue between the free world and the communist world.",
      translation: "在这个世界上，有很多人真正不理解，或者说他们假装不理解，自由世界与共产主义世界之间的重大问题是什么。"
    },
    3: {
      text: "Let them come to Berlin.",
      translation: "让他们来柏林看看。"
    },
    4: {
      text: "There are some who say that communism is the wave of the future.",
      translation: "有些人说共产主义是未来的潮流。"
    },
    5: {
      text: "Let them come to Berlin.",
      translation: "让他们来柏林看看。"
    },
    6: {
      text: "And there are some who say, in Europe and elsewhere, we can work with the communists.",
      translation: "还有一些人说，在欧洲和其他地方，我们可以与共产主义者合作。"
    },
    7: {
      text: "Let them come to Berlin.",
      translation: "让他们来柏林看看。"
    },
    8: {
      text: "And there are even a few who say that it is true that communism is an evil system, but it permits us to make economic progress.",
      translation: "甚至有少数人说，共产主义确实是一个邪恶的制度，但它允许我们取得经济进步。"
    },
    9: {
      text: "Let them come to Berlin.",
      translation: "让他们来柏林看看。"
    },
  },
}

/**
 * 深度修复特定素材
 */
async function deepFixMaterials() {
  try {
    console.log('📖 Deep fixing priority materials...\n')

    let totalFixed = 0

    for (const [materialTitle, fixes] of Object.entries(priorityFixes)) {
      console.log(`🔧 [${materialTitle}]`)

      // 加载素材
      const { data: material, error } = await supabase
        .from('materials')
        .select('transcript')
        .eq('title', materialTitle)
        .single()

      if (error || !material) {
        console.log(`  ⚠️  Material not found: ${error?.message}\n`)
        continue
      }

      const transcript = material.transcript
      let materialFixed = 0

      // 应用修复
      const fixedTranscript = transcript.map((sentence, index) => {
        const sentenceNumber = index + 1

        if (fixes[sentenceNumber]) {
          const fix = fixes[sentenceNumber]

          // 验证文本是否匹配
          if (sentence.text !== fix.text) {
            console.log(`  ⚠️  [${sentenceNumber}] Text mismatch, skipping`)
            return sentence
          }

          console.log(`  [${sentenceNumber}] ✓ Fixed`)
          console.log(`    Old: ${sentence.translation}`)
          console.log(`    New: ${fix.translation}`)

          materialFixed++
          totalFixed++

          return {
            ...sentence,
            translation: fix.translation
          }
        }

        return sentence
      })

      if (materialFixed > 0) {
        // 保存到数据库
        const { error: updateError } = await supabase
          .from('materials')
          .update({ transcript: fixedTranscript })
          .eq('title', materialTitle)

        if (updateError) {
          console.log(`  ⚠️  Failed to save: ${updateError.message}\n`)
        } else {
          console.log(`  ✅ Saved: ${materialFixed} fixes applied\n`)
        }
      } else {
        console.log(`  ℹ️  No fixes applied\n`)
      }
    }

    console.log('='.repeat(70))
    console.log('📊 Summary')
    console.log('='.repeat(70))
    console.log(`Total fixes applied: ${totalFixed}`)
    console.log('✅ Deep fix completed!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the deep fixer
deepFixMaterials()
