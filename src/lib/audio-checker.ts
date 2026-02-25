/**
 * 智能语音比对模块
 * 解决 STT（语音识别）的常见误判问题
 */

// Metaphone 算法实现（简化版）
// 将单词转换为语音编码，忽略发音差异
function metaphone(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return ''

  let result = ''
  let i = 0

  // 跳过无声词开头
  while (i < w.length && 'aeiou'.includes(w[i])) {
    result += w[i]
    i++
  }

  while (i < w.length) {
    const ch = w[i]
    const nextCh = w[i + 1] || ''

    // 特殊规则
    if (ch === 'c' && nextCh === 'h') {
      result += 'x'  // CH → X
      i += 2
    } else if (ch === 'c' && (nextCh === 'e' || nextCh === 'i' || nextCh === 'y')) {
      result += 's'  // CI/CE/CY → S
      i += 2
    } else if (ch === 'c') {
      result += 'k'  // C → K
      i++
    } else if (ch === 'd' && nextCh === 'g') {
      result += 'j'  // DG → J
      i += 2
    } else if (ch === 'g' && (nextCh === 'e' || nextCh === 'i' || nextCh === 'y')) {
      result += 'j'  // GI/GE/GY → J
      i += 2
    } else if (ch === 'g' && nextCh === 'h') {
      result += 'k'  // GH → K
      i += 2
    } else if (ch === 'h' && (i > 0 && 'aeiou'.includes(w[i - 1]))) {
      // 元音后的 H 无声，跳过
      i++
    } else if (ch === 'k' && nextCh === 'n') {
      result += 'n'  // KN → N
      i += 2
    } else if (ch === 'g' && nextCh === 'n') {
      result += 'n'  // GN → N
      i += 2
    } else if (ch === 'p' && nextCh === 'h') {
      result += 'f'  // PH → F
      i += 2
    } else if (ch === 'q') {
      result += 'k'  // Q → K
      i++
    } else if (ch === 's' && nextCh === 'h') {
      result += 'x'  // SH → X
      i += 2
    } else if (ch === 't' && nextCh === 'h') {
      result += '0'  // TH → θ (用0表示)
      i += 2
    } else if (ch === 't' && nextCh === 'c' && (w[i + 2] || '') === 'h') {
      result += '0'  // TCH → θ
      i += 3
    } else if (ch === 'w' && i > 0 && 'aeiou'.includes(w[i - 1])) {
      // 元音后的 W 无声，跳过
      i++
    } else if ('aeiou'.includes(ch)) {
      result += ch
      i++
    } else if ('bdfgjklmnpqrstvxyz'.includes(ch)) {
      result += ch
      i++
    } else {
      i++
    }
  }

  return result
}

// 计算两个 Metaphone 编码的相似度
function calculateMetaphoneSimilarity(code1: string, code2: string): number {
  if (code1 === code2) return 1.0

  // 使用 Levenshtein 距离计算编辑距离
  const dp: number[][] = []
  for (let i = 0; i <= code1.length; i++) {
    dp[i] = []
    for (let j = 0; j <= code2.length; j++) {
      if (i === 0) dp[i][j] = j
      else if (j === 0) dp[i][j] = i
      else {
        const cost = code1[i - 1] === code2[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        )
      }
    }
  }

  const maxLen = Math.max(code1.length, code2.length)
  if (maxLen === 0) return 1.0
  return (maxLen - dp[code1.length][code2.length]) / maxLen
}

// 高频误判词对（STT 常见混淆）
const HIGH_FREQUENCY_MISHEARS: Record<string, string[]> = {
  'this': ['is', 'his', 'this', 'tis'],
  'is': ['this', 'his', 'is', 's'],
  'that': ['at', 'that', 'tat'],
  'there': ['their', 'there', 'here'],
  'their': ['there', 'their', 'there\'s'],
  'think': ['thing', 'think', 'sink'],
  'thing': ['think', 'thing', 'thing'],
  'thought': ['taught', 'thought', 'thot'],
  'though': ['throw', 'though', 'tho'],
  'through': ['threw', 'through', 'thru'],
  'the': ['a', 'the', 'de'],
  'then': ['than', 'then', 'den'],
  'than': ['then', 'than', 'dan'],
  'when': ['wen', 'when', 'win'],
  'what': ['wat', 'what', 'wot'],
  'where': ['were', 'where', 'wear'],
  'were': ['where', 'were', 'we\'re'],
  'your': ['you\'re', 'your', 'you'],
  'you\'re': ['your', 'you\'re', 'you'],
  'of': ['off', 'of', 'ov'],
  'off': ['of', 'off', 'of'],
  'have': ['has', 'have', 'av'],
  'has': ['have', 'has', 'az'],
  'to': ['too', 'to', 'tu'],
  'too': ['to', 'too', 'tu'],
  'two': ['to', 'too', 'two'],
  'for': ['four', 'for', 'fer'],
  'four': ['for', 'four', 'fore'],
  'from': ['form', 'from', 'frm'],
  'form': ['from', 'form', 'fern'],
  'some': ['sum', 'some', 'sem'],
  'come': ['cum', 'come', 'kom'],
  'more': ['moor', 'more', 'mor'],
  'work': ['walk', 'work', 'werk'],
  'walk': ['work', 'walk', 'wol'],
  'word': ['world', 'word', 'wird'],
  'world': ['word', 'world', 'wereld'],
  'hear': ['here', 'hear', 'here'],
  'here': ['hear', 'here', 'hear'],
  'know': ['no', 'know', 'kno'],
  'no': ['know', 'no', 'now'],
  'new': ['knew', 'new', 'nu'],
  'knew': ['new', 'knew', 'n'],
  'right': ['write', 'right', 'rit'],
  'write': ['right', 'write', 'rit'],
  'which': ['witch', 'which', 'wich'],
  'witch': ['which', 'witch', 'wich'],
  'where': ['were', 'wear', 'where'],
  'wear': ['were', 'where', 'wear'],
  'were': ['where', 'wear', 'were'],
}

// 上下文感知的高频词对（基于 N-gram 概率）
const CONTEXTUAL_PAIRS: Array<[string, string, number]> = [
  // [target, recognized, probability_weight]
  ['this', 'is', 0.85],  // "however this" 中 this 概率极高
  ['that', 'at', 0.70],
  ['there', 'here', 0.65],
  ['think', 'thing', 0.75],
  ['thought', 'taught', 0.70],
  ['from', 'form', 0.65],
  ['have', 'has', 0.60],
  ['some', 'sum', 0.65],
  ['know', 'no', 0.70],
  ['right', 'write', 0.70],
  ['which', 'witch', 0.65],
  ['where', 'were', 0.70],
  ['your', 'you\'re', 0.70],
]

/**
 * 智能匹配两个单词
 * @param targetWord 目标单词（原文）
 * @param spokenWord 用户朗读的单词（STT识别）
 * @param contextWords 上下文单词（用于概率校验）
 * @returns 匹配结果和相似度分数
 */
export interface IntelligentMatchResult {
  isMatch: boolean
  confidence: number  // 0-1，置信度
  matchType: 'exact' | 'metaphone' | 'contextual' | 'fuzzy' | 'no_match'
  reason: string
}

export function intelligentMatch(
  targetWord: string,
  spokenWord: string,
  contextWords?: string[]
): IntelligentMatchResult {
  // 预处理：转小写，移除标点
  const normalize = (w: string) => w.toLowerCase().replace(/[^\w]/g, '')
  const target = normalize(targetWord)
  const spoken = normalize(spokenWord)

  // 1. 精确匹配
  if (target === spoken) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Exact match'
    }
  }

  // 2. 检查高频误判词表
  const mishears = HIGH_FREQUENCY_MISHEARS[target] || []
  if (mishears.includes(spoken)) {
    return {
      isMatch: true,
      confidence: 0.90,
      matchType: 'fuzzy',
      reason: 'High-frequency mishear pair (STT error correction)'
    }
  }

  // 3. Metaphone 语音相似度检测
  const targetMetaphone = metaphone(target)
  const spokenMetaphone = metaphone(spoken)
  const metaphoneSimilarity = calculateMetaphoneSimilarity(targetMetaphone, spokenMetaphone)

  if (metaphoneSimilarity >= 0.8) {
    return {
      isMatch: true,
      confidence: 0.85,
      matchType: 'metaphone',
      reason: `Metaphone similarity ${(metaphoneSimilarity * 100).toFixed(0)}%`
    }
  }

  // 4. 上下文感知匹配（基于 N-gram 概率）
  if (contextWords && contextWords.length > 0) {
    for (const [ctxTarget, ctxSpoken, weight] of CONTEXTUAL_PAIRS) {
      if (target === ctxTarget && spoken === ctxSpoken) {
        // 检查上下文是否支持这个匹配
        // 例如："however this" 中 this 的概率远高于 is
        const contextScore = calculateContextProbability(target, spoken, contextWords)

        if (contextScore >= 0.7) {
          return {
            isMatch: true,
            confidence: 0.75 + (contextScore * 0.1),
            matchType: 'contextual',
            reason: `Context-aware match (probability ${(contextScore * 100).toFixed(0)}%)`
          }
        }
      }
    }
  }

  // 5. A2 级别宽松判定：核心元音匹配
  const targetVowels = target.replace(/[^aeiou]/g, '')
  const spokenVowels = spoken.replace(/[^aeiou]/g, '')

  if (targetVowels === spokenVowels && targetVowels.length > 0) {
    // 核心元音匹配，即使辅音丢失也算部分正确
    return {
      isMatch: true,
      confidence: 0.65,
      matchType: 'fuzzy',
      reason: 'Core vowels match (A2 level tolerance)'
    }
  }

  // 6. 辅音丢失降权处理（th → h/s，s → 空）
  if (isConsonantDrop(target, spoken)) {
    return {
      isMatch: true,
      confidence: 0.70,
      matchType: 'fuzzy',
      reason: 'Consonant drop detected (STT common error)'
    }
  }

  // 7. 词尾 s/es 丢失
  if (target.endsWith('s') && spoken === target.slice(0, -1)) {
    return {
      isMatch: true,
      confidence: 0.80,
      matchType: 'fuzzy',
      reason: 'Plural/present tense -s dropped'
    }
  }

  if (target.endsWith('es') && spoken === target.slice(0, -2)) {
    return {
      isMatch: true,
      confidence: 0.80,
      matchType: 'fuzzy',
      reason: 'Verb ending -es dropped'
    }
  }

  // 不匹配
  return {
    isMatch: false,
    confidence: 0,
    matchType: 'no_match',
    reason: 'No significant similarity found'
  }
}

// 检查是否是辅音丢失（如 this → is）
function isConsonantDrop(target: string, spoken: string): boolean {
  // th 开头丢失
  if (target.startsWith('th') && spoken === target.slice(2)) {
    return true
  }

  // s 开头丢失
  if (target.startsWith('s') && spoken === target.slice(1)) {
    return true
  }

  // h 开头丢失
  if (target.startsWith('h') && spoken === target.slice(1)) {
    return true
  }

  return false
}

// 计算上下文概率（简化版 N-gram）
function calculateContextProbability(
  target: string,
  spoken: string,
  context: string[]
): number {
  // 简单实现：检查目标词在前一个词后面出现的概率
  // 实际应用中可以使用真实的 N-gram 模型或 LLM

  const prevWord = context[context.length - 1]?.toLowerCase() || ''

  // 特殊规则：某些词对组合的概率权重
  const bigramWeights: Record<string, Record<string, number>> = {
    'however': { 'this': 0.95, 'is': 0.05 },  // however this 远比 however is 常见
    'but': { 'this': 0.70, 'is': 0.30 },
    'and': { 'this': 0.60, 'is': 0.40 },
    'when': { 'this': 0.65, 'is': 0.35 },
  }

  if (prevWord in bigramWeights && target in bigramWeights[prevWord]) {
    return bigramWeights[prevWord][target]
  }

  // 默认中等概率
  return 0.5
}

/**
 * 批量比对单词列表
 */
export function batchIntelligentMatch(
  targetWords: string[],
  spokenWords: string[]
): Array<{
  targetIndex: number
  spokenIndex: number
  result: IntelligentMatchResult
}> {
  const results: Array<{
    targetIndex: number
    spokenIndex: number
    result: IntelligentMatchResult
  }> = []

  // 简单的一对一匹配（实际应用中可以使用更复杂的对齐算法）
  const maxLen = Math.max(targetWords.length, spokenWords.length)

  for (let i = 0; i < maxLen; i++) {
    const target = targetWords[i]
    const spoken = spokenWords[i]

    if (!target || !spoken) {
      continue
    }

    // 提取上下文（前后各1个词）
    const context = [
      targetWords[Math.max(0, i - 1)],
      ...targetWords.slice(i + 1, i + 2)
    ]

    const result = intelligentMatch(target, spoken, context)

    results.push({
      targetIndex: i,
      spokenIndex: i,
      result
    })
  }

  return results
}
