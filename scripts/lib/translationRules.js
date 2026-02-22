/**
 * Translation Rules for Educational & Geographical Context
 * 按教育内容和地理语境的翻译规则
 */

module.exports = {
  // 翻译后处理规则
  postProcessRules: [
    // Rule 1: 地理位置 - above/below + 国家
    {
      name: 'Geographic Position (above/below)',
      pattern: /位于([^，。]*)高于([^，。]*)/g,
      replacement: '位于$1以北$2',
      description: '"above" + 国家 → "以北"，"below" + 国家 → "以南"'
    },
    {
      pattern: /位于([^，。]*)低于([^，。]*)/g,
      replacement: '位于$1以南$2',
      description: '"below" 的修正'
    },

    // Rule 2: 大洲名称 - 统一使用"洲"结尾
    {
      name: 'Continent Names',
      patterns: {
        // Use strings, regex will be applied in applyRules
        '北美大陆': '北美洲',
        '南美大陆': '南美洲',
        '欧洲大陆': '欧洲',
        '亚洲大陆': '亚洲',
        '非洲大陆': '非洲',
        '大洋大陆': '大洋洲',
        '南极大陆': '南极洲'
      },
      description: '大洲名称统一翻译为"洲"（北美洲、南美洲等）'
    },

    // Rule 3: 常见地理术语
    {
      name: 'Common Geographic Terms',
      patterns: {
        '太平洋': '太平洋',
        '大西洋': '大西洋',
        '北冰洋': '北冰洋',
        '印度洋': '印度洋',
        '落基山脉': '落基山脉',
        '洛矶山脉': '落基山脉',
        '安大略省': '安大略省',
        '魁北克省': '魁北克省',
        '不列颠哥伦比亚省': '不列颠哥伦比亚省'
      },
      description: '地理术语统一翻译'
    },

    // Rule 4: 省份名称规范
    {
      name: 'Province Names',
      pattern: /([^\s]+省)省/g,
      replacement: '$1',
      description: '避免重复的"省"字（如"萨斯喀彻温省省" → "萨斯喀彻温省"）'
    }
  ],

  // 需要人工检查的规则
  reviewRules: [
    {
      name: 'Check for literal translations',
      pattern: /高于|低于/,
      description: '检查是否正确翻译了地理位置关系'
    },
    {
      name: 'Check for missing context',
      patterns: ['大陆', '大陆'],
      description: '检查"North America"等是否翻译为"北美洲"'
    }
  ],

  /**
   * 应用后处理规则
   */
  applyRules(text) {
    let result = text

    // Apply pattern replacements
    this.postProcessRules.forEach(rule => {
      if (rule.pattern && rule.replacement) {
        result = result.replace(rule.pattern, rule.replacement)
      }

      if (rule.patterns) {
        Object.keys(rule.patterns).forEach(key => {
          // Convert string to global regex
          const pattern = new RegExp(key, 'g')
          result = result.replace(pattern, rule.patterns[key])
        })
      }
    })

    return result
  },

  /**
   * 检查翻译是否符合规则
   */
  validate(originalText, translatedText) {
    const issues = []

    // Check 1: 地理位置
    if (originalText.toLowerCase().includes('above') && translatedText.includes('高于')) {
      issues.push({
        type: 'error',
        rule: 'geographic_position',
        message: '"above" 在地理语境下应翻译为"以北"或"北边"，而非"高于"'
      })
    }

    if (originalText.toLowerCase().includes('below') && translatedText.includes('低于')) {
      issues.push({
        type: 'error',
        rule: 'geographic_position',
        message: '"below" 在地理语境下应翻译为"以南"或"南边"，而非"低于"'
      })
    }

    // Check 2: 大洲名称
    if (originalText.toLowerCase().includes('north america') &&
        translatedText.includes('大陆') &&
        !translatedText.includes('北美洲')) {
      issues.push({
        type: 'warning',
        rule: 'continent_name',
        message: '"North America" 应翻译为"北美洲"，而非"北美大陆"'
      })
    }

    // Check 3: 省份名称重复
    if (/(省)省/.test(translatedText)) {
      issues.push({
        type: 'error',
        rule: 'duplicate_province',
        message: '省份名称中"省"字重复（如"萨斯喀彻温省省"）'
      })
    }

    // Check 4: 地理术语一致性
    const geographicTerms = {
      'Rocky Mountains': ['落基山脉', '洛矶山脉'],
      'British Columbia': ['不列颠哥伦比亚省']
    }

    return {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      issues
    }
  }
}
