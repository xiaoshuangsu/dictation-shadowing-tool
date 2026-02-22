/**
 * 重新翻译 "Come to the Fair" 素材
 * 使用更正式、更准确的翻译
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * 手动翻译 - 针对教育性内容的正式翻译
 */
const formalTranslations = {
  1: {
    text: "Come to the Fair.",
    translation: "欢迎来到集市。"
  },
  2: {
    text: "Fall fairs have been a feature of North American life since early in the 19th century.",
    translation: "自19世纪初以来，秋季集市一直是北美生活的重要组成部分。"
  },
  3: {
    text: "At the end of the harvest, people from rural areas have come together to celebrate.",
    translation: "收获季节结束时，农村地区的居民聚集在一起庆祝。"
  },
  4: {
    text: "Usually, these fairs take the form of a competition regarding the best of all farm products of that year.",
    translation: "通常，这些集市以竞赛形式举办，评选当年的最佳农产品。"
  },
  5: {
    text: "Depending on the part of the country and its most important crop, fall fairs can begin as early as August or as late as November.",
    translation: "根据地区和其主要农作物的不同，秋季集市可能早在8月或晚至11月开始。"
  },
  6: {
    text: "They usually last several days.",
    translation: "集市通常持续数天。"
  },
  7: {
    text: "When the United States and Canada were organized, they were divided into small units called counties.",
    translation: "美国和加拿大建立行政区划时，被划分为称为县的小型行政单位。"
  },
  8: {
    text: "Larger units were called states or provinces.",
    translation: "更大的行政单位称为州或省。"
  },
  9: {
    text: "The earliest fairs were organized by these agricultural groups.",
    translation: "早期的集市由这些农业团体组织。"
  },
  10: {
    text: "Later, governments got involved.",
    translation: "后来，政府也开始参与。"
  },
  11: {
    text: "Since these fairs are usually annual events, many have developed permanent buildings over the years.",
    translation: "由于这些集市通常是一年一度的活动，多年来许多集市建起了永久性建筑。"
  },
  12: {
    text: "Most of these are large barn-like structures.",
    translation: "这些建筑大多是大型谷仓式结构。"
  },
  13: {
    text: "These buildings are used to display new products for farm life such as tractors, home furnishings and water systems.",
    translation: "这些建筑用于展示农业生活的新产品，如拖拉机、家居用品和水系统。"
  },
  14: {
    text: "Several barns are usually necessary to house all the horses, cows, pigs, goats, sheep, chickens and other animals in competition.",
    translation: "通常需要多个谷仓来容纳所有参赛的马、牛、猪、山羊、绵羊、鸡和其他动物。"
  },
  15: {
    text: "There must also be room to display all the vegetables, berries and fruits in competition.",
    translation: "还必须有空间展示所有参赛的蔬菜、浆果和水果。"
  },
  16: {
    text: "Finally, there is space for handicrafts, artwork, baked goods, and jams and jellies.",
    translation: "最后，还有展示手工艺品、艺术品、烘焙食品以及果酱和果冻的空间。"
  },
  17: {
    text: "Most fairs have a large building where people can sit down and eat.",
    translation: "大多数集市都有一个大型建筑，人们可以坐下来进食。"
  },
  18: {
    text: "The food is usually very good.",
    translation: "食物通常非常美味。"
  },
  19: {
    text: "There are often smaller, local fairs, but there are also large ones like the Canadian National Exhibition.",
    translation: "通常有较小的地方性集市，也有像加拿大国家展览会这样的大型集市。"
  },
  20: {
    text: "The Canadian National Exhibition is held in Toronto, Ontario.",
    translation: "加拿大国家展览会在安大略省多伦多举办。"
  },
  21: {
    text: "Most fairs also have a racetrack, which is used for horse racing, or in some cases, auto racing.",
    translation: "大多数集市还有赛道，用于赛马，有时也用于赛车。"
  },
  22: {
    text: "Fairs have helped to improve animal breeds and races encourage the breeding of fast horses.",
    translation: "集市有助于改良牲畜品种，赛马比赛也促进了快马的繁育。"
  },
  23: {
    text: "Plowing contests test the strength and steadiness of horses, and so do pulling contests.",
    translation: "耕犁比赛考验马的力量和稳定性，拉车比赛也是如此。"
  },
  24: {
    text: "This spirit of competition has led to improvements in all areas of farming.",
    translation: "这种竞争精神推动了农业各个领域的改进。"
  },
  25: {
    text: "Every kind of grain, fruit, vegetable, berry, and animal is tested, and only the best win a ribbon.",
    translation: "每种粮食、水果、蔬菜、浆果和动物都要经过测试，只有最优秀的才能赢得奖带。"
  },
  26: {
    text: "This encourages farmers to improve their products.",
    translation: "这激励农民改进其产品。"
  },
  27: {
    text: "Farm women compete to produce the best homemade food and crafts.",
    translation: "农妇们竞争制作最好的自制食品和手工艺品。"
  },
  28: {
    text: "Many kinds of fruit and vegetables are stored in glass jars for the winter.",
    translation: "许多种水果和蔬菜被储存在玻璃罐中以备冬季食用。"
  },
  29: {
    text: "The best of these also receive prizes.",
    translation: "其中最优秀的也会获奖。"
  },
  30: {
    text: "The goal of improving farming is sponsored by the governments of Canada and the USA.",
    translation: "改进农业的目标由加拿大和美国政府赞助支持。"
  },
  31: {
    text: "Four H clubs are youth organizations that encourage farm children to take an interest in farming.",
    translation: "四健会是鼓励农村儿童对农业产生兴趣的青年组织。"
  },
  32: {
    text: "Four H clubs aim at improving the heads, hearts, hands, and health of their members.",
    translation: "四健会致力于提升会员的智力、品德、动手能力和健康水平。"
  },
  33: {
    text: "There are also women's organizations, such as the Women's Institutes in Canada, which work to make the life of farm families better.",
    translation: "还有妇女组织，如加拿大的妇女协会，致力于改善农村家庭的生活。"
  },
  34: {
    text: "Fall fairs have taken over the idea of the midway from the circus.",
    translation: "秋季集市借鉴了马戏团的中间娱乐区概念。"
  },
  35: {
    text: "The midway has rides like Ferris wheels, merry-go-rounds, and roller coasters.",
    translation: "娱乐区有摩天轮、旋转木马和过山车等游乐设施。"
  },
  36: {
    text: "It also has games of chance and skill, such as trying to throw a small hoop over a large bottle.",
    translation: "还有运气和技巧游戏，例如试图将小圆环扔到大瓶子上。"
  },
  37: {
    text: "Most fairs have a grandstand show where performers entertain the crowds.",
    translation: "大多数集市都有看台表演，表演者娱乐观众。"
  },
  38: {
    text: "Country western singers are popular at fairs, and so are comedians, clowns, dancers and musicians.",
    translation: "乡村西部歌手在集市上很受欢迎，喜剧演员、小丑、舞者和音乐家也是如此。"
  },
  39: {
    text: "There may also be other contests, such as beauty pageants, strength contests for men, or pie eating contests.",
    translation: "可能还有其他比赛，如选美比赛、男子力量比赛或吃派比赛。"
  },
  40: {
    text: "Many fairs have a midway where there are rides and games, and a grandstand where there are shows.",
    translation: "许多集市有游乐设施和游戏的娱乐区，以及有表演的看台。"
  },
  41: {
    text: "One nice thing about fall fairs is that they are fun for the whole family.",
    translation: "秋季集市的一个优点是全家人都能享受乐趣。"
  },
  42: {
    text: "Children enjoy the midway and the farm animals.",
    translation: "孩子们喜欢娱乐区和农场动物。"
  },
  43: {
    text: "Women like the crafts, food and household exhibits.",
    translation: "女性喜欢手工艺品、食品和家居展览。"
  },
  44: {
    text: "Men like the machinery, the horse races and the crop exhibits.",
    translation: "男性喜欢机械、赛马和农作物展览。"
  },
  45: {
    text: "Everyone likes the grandstand shows.",
    translation: "每个人都喜欢看台表演。"
  },
  46: {
    text: "Nowadays, not so many people live on farms, but people from towns and cities still enjoy going to fall fairs.",
    translation: "如今，住在农场的人不多，但城镇和城市的人仍然喜欢去秋季集市。"
  },
  47: {
    text: "They are part of our North American heritage.",
    translation: "它们是我们北美传统的一部分。"
  },
  48: {
    text: "One nice thing about fall fairs is that they are fun for the whole family.",
    translation: "秋季集市的一个优点是全家人都能享受乐趣。"
  },
  49: {
    text: "Children enjoy the midway and the farm animals, women like the crafts, food, and household exhibits,",
    translation: "孩子们喜欢娱乐区和农场动物，女性喜欢手工艺品、食品和家居展览，"
  },
  50: {
    text: "men like the machinery, the horse races, and the crop exhibits.",
    translation: "男性喜欢机械、赛马和农作物展览。"
  },
  51: {
    text: "Everyone likes the grandstand shows.",
    translation: "每个人都喜欢看台表演。"
  },
  52: {
    text: "Nowadays, not so many people live on farms, but people from towns and cities still enjoy going to fall fairs.",
    translation: "如今，住在农场的人不多，但城镇和城市的人仍然喜欢去秋季集市。"
  },
  53: {
    text: "They are part of our North American heritage.",
    translation: "它们是我们北美传统的一部分。"
  }
}

async function retranslateMaterial() {
  try {
    console.log('📖 Loading "Come to the Fair" from database...')

    const { data: material, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('title', 'Come to the Fair')
      .single()

    if (fetchError) throw fetchError
    if (!material) throw new Error('Material not found')

    console.log(`✅ Found ${material.transcript.length} sentences`)
    console.log('\n🔧 Applying formal translations...\n')

    let updateCount = 0

    const updatedTranscript = material.transcript.map((sentence, index) => {
      const sentenceNumber = index + 1

      if (formalTranslations[sentenceNumber]) {
        const newTrans = formalTranslations[sentenceNumber]

        // Check if text matches (to ensure correct alignment)
        if (sentence.text !== newTrans.text) {
          console.log(`⚠️  [${sentenceNumber}] Text mismatch!`)
          console.log(`  DB:  ${sentence.text}`)
          console.log(`  New: ${newTrans.text}`)
        }

        console.log(`[${sentenceNumber}] ✓ Updated`)
        console.log(`  EN: ${sentence.text.substring(0, 70)}...`)
        console.log(`  Old: ${sentence.translation}`)
        console.log(`  New: ${newTrans.translation}`)
        console.log('')

        updateCount++

        return {
          ...sentence,
          translation: newTrans.translation
        }
      }

      return sentence
    })

    console.log('\n' + '='.repeat(70))
    console.log(`📊 Translation Summary`)
    console.log('='.repeat(70))
    console.log(`Total sentences: ${material.transcript.length}`)
    console.log(`Updated: ${updateCount}`)

    if (updateCount > 0) {
      console.log('\n💾 Saving to database...')

      const { error: updateError } = await supabase
        .from('materials')
        .update({ transcript: updatedTranscript })
        .eq('title', 'Come to the Fair')

      if (updateError) throw updateError

      console.log('✅ Successfully saved formal translations!')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run the retranslator
retranslateMaterial()
