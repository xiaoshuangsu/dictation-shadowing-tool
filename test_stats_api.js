/**
 * 测试脚本：验证统计 API 和统计联动
 *
 * 使用方法：
 * 1. 确保 npm run dev 正在运行
 * 2. 修改下面的 USER_ID 为你的实际用户 ID
 * 3. 运行：node test_stats_api.js
 */

const USER_ID = 'YOUR_USER_ID_HERE' // 👈 替换为你的实际用户 ID
const BASE_URL = 'http://localhost:3000'

async function testStatsAPI() {
  console.log('🧪 开始测试统计 API...\n')

  try {
    // 1. 获取统计数据（复习前）
    console.log('1️⃣ 获取复习前统计数据...')
    const beforeResponse = await fetch(`${BASE_URL}/api/user-words/stats`, {
      headers: {
        'Authorization': `Bearer ${USER_ID}`
      }
    })

    if (!beforeResponse.ok) {
      throw new Error(`获取统计失败: ${beforeResponse.status}`)
    }

    const beforeData = await beforeResponse.json()
    console.log('✅ 复习前统计:', beforeData.stats)
    console.log(`   - Due Today: ${beforeData.stats.dueWords}`)
    console.log(`   - Reviewed: ${beforeData.stats.reviewed}`)
    console.log(`   - Accuracy: ${beforeData.stats.accuracy}%`)
    console.log(`   - Streak: ${beforeData.stats.streak}`)
    console.log('')

    // 2. 模拟复习操作（更新一个单词的掌握状态）
    console.log('2️⃣ 模拟复习操作...')
    console.log('   提示：请在浏览器中手动执行以下操作：')
    console.log('   a. 访问 http://localhost:3000/vocabulary')
    console.log('   b. 点击 "My Words"')
    console.log('   c. 选择一个单词进行复习')
    console.log('   d. 点击任意自评按钮（Still Learning/Kinda Know/Too Easy）')
    console.log('')

    // 3. 等待用户操作
    console.log('3️⃣ 等待 10 秒，观察控制台日志...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    console.log('')

    // 4. 再次获取统计数据（复习后）
    console.log('4️⃣ 获取复习后统计数据...')
    const afterResponse = await fetch(`${BASE_URL}/api/user-words/stats`, {
      headers: {
        'Authorization': `Bearer ${USER_ID}`
      }
    })

    if (!afterResponse.ok) {
      throw new Error(`获取统计失败: ${afterResponse.status}`)
    }

    const afterData = await afterResponse.json()
    console.log('✅ 复习后统计:', afterData.stats)
    console.log(`   - Due Today: ${afterData.stats.dueWords}`)
    console.log(`   - Reviewed: ${afterData.stats.reviewed}`)
    console.log(`   - Accuracy: ${afterData.stats.accuracy}%`)
    console.log(`   - Streak: ${afterData.stats.streak}`)
    console.log('')

    // 5. 对比数据
    console.log('5️⃣ 数据对比:')
    const reviewedDiff = afterData.stats.reviewed - beforeData.stats.reviewed
    console.log(`   - Reviewed 变化: ${beforeData.stats.reviewed} → ${afterData.stats.reviewed} (${reviewedDiff > 0 ? '+' : ''}${reviewedDiff})`)

    if (reviewedDiff > 0) {
      console.log('   ✅ 统计联动正常！Reviewed 计数已自动更新')
    } else {
      console.log('   ⚠️  Reviewed 计数未变化，请检查是否完成了复习操作')
    }

    console.log('')
    console.log('🎉 测试完成！')
    console.log('')
    console.log('📋 验证清单：')
    console.log(`   [${afterData.stats.dueWords >= 0 ? '✅' : '❌'}] Due Today 正确计算`)
    console.log(`   [${afterData.stats.reviewed >= 0 ? '✅' : '❌'}] Reviewed 正确计算`)
    console.log(`   [${afterData.stats.accuracy >= 0 && afterData.stats.accuracy <= 100 ? '✅' : '❌'}] Accuracy 在 0-100 范围内`)
    console.log(`   [${afterData.stats.streak >= 0 ? '✅' : '❌'}] Streak 正确获取`)

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    console.error('')
    console.error('💡 可能的原因：')
    console.error('   1. USER_ID 未设置或不正确')
    console.error('   2. 开发服务器未运行（npm run dev）')
    console.error('   3. 用户未登录或无权限')
    process.exit(1)
  }
}

// 运行测试
testStatsAPI()
