/**
 * 翻译改进规则系统
 * 目标：在口语化、正式和准确之间找到平衡
 * 适用于教育性地理内容
 */

module.exports = {
  /**
   * 词汇替换规则 - 提升正式度
   */
  vocabularyRules: [
    // 动词替换 - 更精确的正则
    {
      name: '正式动词',
      patterns: {
        '分为(.{1,10})个': '划分为$1个',
        '叫做': '称为',
        '位于': '坐落于',
        '有(.{1,5})居住': '人口为$1',
        '使用(.{1,5})语': '使用$1语',
        '许多(.{1,5})来到': '众多$1前往',
        '向东移动': '向东行进',
        '向西移动': '向西行进',
        '向北移动': '向北行进',
        '向南移动': '向南行进',
      },
      context: 'formal'
    },

    // 形容词/副词替换 - 更精确的使用场景
    {
      name: '正式形容词',
      patterns: {
        '最重要的是': '首要的是',
        '最大的国家': '规模最大的国家',
        '最大的城市': '规模最大的城市',
        '最寒冷': '气温最低',
        '最古老的': '历史最悠久的',
        '非常寒冷': '极其寒冷',
        '非常困难': '极其困难',
        '许多人们': '众多民众',
        '许多城市': '众多城市',
        '许多农场': '众多农场',
      },
      context: 'formal'
    },

    // 名词替换
    {
      name: '正式名词',
      patterns: {
        '土地': '地区',
        '地方': '地区',
        '山脉': '山脉',
        '人们': '居民',
        '人': '民众',
        '城市': '城市',
        '国家': '国家',
        '产业': '产业',
        '行业': '行业',
      },
      context: 'formal'
    },
  ],

  /**
   * 句式优化规则
   */
  sentenceStructureRules: [
    // 避免主语重复
    {
      name: '主语重复优化',
      pattern: /不列颠哥伦比亚省(.{0,20})不列颠哥伦比亚省/g,
      replacement: '该省$1',
      description: '避免同一句子中重复主语'
    },

    // "There are" 句型优化
    {
      name: 'There are 句型优化',
      pattern: /有(.{1,10})在(.{1,20})/g,
      replacement: '$2拥有$1',
      description: '将"有...在..."改为"拥有"'
    },

    // "Moving east/west" 优化
    {
      name: '方位移动优化',
      patterns: {
        '向东移动': '向东行进',
        '向西移动': '向西行进',
        '向北移动': '向北行进',
        '向南移动': '向南行进',
      }
    },

    // 数量表达优化
    {
      name: '数量表达优化',
      patterns: {
        '2万人': '2万人口',
        '200万人': '200万人口',
        '成千上万的': '数以千计的',
        '数百万': '数百万',
      }
    },
  ],

  /**
   * 地理术语规范
   */
  geographicTerms: {
    // 省份名称（避免重复）
    provinceNames: [
      '不列颠哥伦比亚省',
      '阿尔伯塔省',
      '萨斯喀彻温省',
      '马尼托巴省',
      '安大略省',
      '魁北克省',
      '新不伦瑞克省',
      '新斯科舍省',
      '爱德华王子岛省',
      '纽芬兰省',
    ],

    // 标准翻译
    standardTerms: {
      'Rocky Mountains': '落基山脉',
      'Rocky Mountain': '落基山脉',
      'Prairie provinces': '草原省份',
      'the Prairies': '大草原',
      'Great Lakes': '五大湖',
      'Arctic Ocean': '北冰洋',
      'Pacific Ocean': '太平洋',
      'Atlantic Ocean': '大西洋',
      'North America': '北美洲',
      'native people': '原住民',
      'Inuit': '因纽特人',
      'First Nations': '第一民族',
    }
  },

  /**
   * 教育性内容语气规范
   */
  educationalToneRules: [
    // 避免"据说"
    {
      name: '避免不确定性表达',
      patterns: {
        '据说': '以...著称',
        '据说是': '以...闻名',
        '人们说': '普遍认为',
      }
    },

    // 产业描述优化
    {
      name: '产业描述优化',
      patterns: {
        '是一个重要的产业': '是重要产业',
        '也是一个重要的产业': '同样是重要产业',
        '提供': '供应',
        '为世界各地的人们提供': '供应全球',
      }
    },

    // 资源描述优化
    {
      name: '资源描述优化',
      patterns: {
        '有许多油气田': '蕴藏丰富的油气资源',
        '发现了许多矿山': '蕴藏丰富的矿产资源',
        '有许多': '拥有大量',
        '有(.{1,10})田': '拥有丰富的$1资源',
      }
    },

    // 城市描述优化
    {
      name: '城市描述优化',
      patterns: {
        '是一个重要的产业': '是重要产业',
        '生产汽车和钢铁': '以汽车制造和钢铁工业为主',
        '有良好的农田': '拥有肥沃农田',
        '是非常多岩石的': '多为岩石地形',
        '有数百年历史的': '拥有数百年历史的',
      }
    },
  ],

  /**
   * 特定句子的完整重写
   * 针对那些仅靠规则无法修复的翻译
   */
  sentenceRewrites: {
    // Sentence 3
    '加拿大分为10个省和3个地区，每个省不同。': '加拿大划分为10个省和3个地区，各省特色鲜明。',

    // Sentence 7
    '不列颠哥伦比亚省的大部分土地都是多山的，广阔的森林覆盖着不列颠哥伦比亚省的山脉。': '不列颠哥伦比亚省多为山地，广阔的森林覆盖其山脉。',

    // Sentence 9
    '从不列颠哥伦比亚省向东移动，接下来的省份是阿尔伯塔省、萨斯喀彻温省和马尼托巴省。': '从不列颠哥伦比亚省向东行进，依次为阿尔伯塔省、萨斯喀彻温省和马尼托巴省。',

    // Sentence 10
    '这些被称为草原省，因为它们主要由平坦的草地组成，称为草原。': '这些省份被称为草原省份，因为它们主要由平坦的草原组成。',

    // Sentence 15
    '马尼托巴省是另一个草原省，也是其最大的城市。': '马尼托巴省是另一个草原省份，其最大城市为温尼伯。',

    // Sentence 16
    '温尼伯位于太平洋和大西洋之间。': '温尼伯位于太平洋与大西洋之间。',

    // Sentence 18
    '向东移动，下一个省份是安大略省。': '向东行进，下一个省份为安大略省。',

    // Sentence 19
    '安大略省北部的土地非常多岩石，包含成千上万的湖泊。': '安大略省北部多为岩石地形，拥有数以千计的湖泊。',

    // Sentence 20
    '在安大略省北部发现了许多矿山。': '安大略省北部蕴藏丰富的矿产资源。',

    // Sentence 21
    '在安大略省南部，有良好的农田，也有许多工厂生产汽车和钢铁的城市。': '安大略省南部拥有肥沃农田，也有许多以汽车制造和钢铁工业为主的城市。',

    // Sentence 23
    '在安大略省南部，有四个世界上最大的湖泊，被称为五大湖。': '安大略省南部有四座全球最大的湖泊，统称为五大湖。',

    // Sentence 30
    '加拿大东部是大西洋省份，毗邻大西洋。': '加拿大东部为大西洋省份，毗邻大西洋。',

    // Sentence 31
    '这些省份包括新不伦瑞克省、新斯科舍省、爱德华王子岛省和纽芬兰省。': '这些省份包括新不伦瑞克省、新斯科舍省、爱德华王子岛省和纽芬兰与拉布拉多省。',

    // Sentence 33
    '旅游业也很重要，因为许多人来到这些省份的美景。': '旅游业同样重要，许多游客前来欣赏这些省份的美景。',

    // Sentence 34
    '据说这些省份的人民是加拿大最友好的。': '这些省份的居民以友好著称，是加拿大最友好的群体。',

    // Sentence 35
    '加拿大最北部是北冰洋、育空、西北地区和努纳武特地区旁边的三个地区。': '加拿大最北部毗邻北冰洋，有育空、西北地区和努纳武特三个地区。',
  },

  /**
   * 应用所有改进规则
   */
  improve(text) {
    let result = text

    // 1. 先检查是否需要完全重写
    for (const [original, improved] of Object.entries(this.sentenceRewrites)) {
      if (result === original) {
        return improved
      }
    }

    // 2. 应用句式优化规则
    this.sentenceStructureRules.forEach(rule => {
      if (rule.pattern && rule.replacement) {
        result = result.replace(rule.pattern, rule.replacement)
      }
      if (rule.patterns) {
        Object.keys(rule.patterns).forEach(key => {
          const pattern = new RegExp(key, 'g')
          result = result.replace(pattern, rule.patterns[key])
        })
      }
    })

    // 3. 应用教育性内容语气规范
    this.educationalToneRules.forEach(rule => {
      if (rule.patterns) {
        Object.keys(rule.patterns).forEach(key => {
          const pattern = new RegExp(key, 'g')
          result = result.replace(pattern, rule.patterns[key])
        })
      }
    })

    // 4. 应用词汇替换规则
    this.vocabularyRules.forEach(rule => {
      if (rule.patterns) {
        Object.keys(rule.patterns).forEach(key => {
          // 使用更精确的正则，避免过度替换
          const pattern = new RegExp(key, 'g')
          result = result.replace(pattern, rule.patterns[key])
        })
      }
    })

    return result
  },

  /**
   * 验证翻译质量
   */
  validate(originalText, translatedText) {
    const issues = []

    // 检查过于口语化的表达
    const colloquialPatterns = [
      /都是(.{1,10})的/,  // "都是多山的"
      /有(.{1,10})在/,    // "有许多...在"
      /有(.{1,5})居住/,   // "有...居住"
      /据说是/,           // "据说是"
      /人们说/,           // "人们说"
    ]

    colloquialPatterns.forEach(pattern => {
      if (pattern.test(translatedText)) {
        issues.push({
          type: 'warning',
          message: `翻译可能过于口语化: "${translatedText.match(pattern)[0]}"`
        })
      }
    })

    // 检查重复
    const words = translatedText.split(/[^省市区]/).filter(w => w.length > 3)
    const wordCount = {}
    words.forEach(w => {
      if (w.includes('省') || w.includes('地区')) {
        wordCount[w] = (wordCount[w] || 0) + 1
      }
    })

    Object.entries(wordCount).forEach(([word, count]) => {
      if (count > 2) {
        issues.push({
          type: 'warning',
          message: `"${word}" 重复 ${count} 次，考虑优化`
        })
      }
    })

    return {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      issues
    }
  }
}
