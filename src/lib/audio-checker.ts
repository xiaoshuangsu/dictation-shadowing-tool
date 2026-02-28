/**
 * 智能语音比对模块 - "口语优先"容错版本
 * 核心理念：只要发音在合理范围内，一律判定为正确
 */

// ============ 常见连读/缩写等效映射 ============
// 处理 "we've" vs "we", "I'm" vs "I am" 等情况
const CONTRACTION_EQUIVALENTS: Record<string, string[]> = {
  "we've": ['we', 'we have'],
  "i'm": ['i', 'i am'],
  "i'll": ['i', 'i will'],
  "i'd": ['i', 'i would', 'i had'],
  "you're": ['you', 'you are'],
  "he's": ['he', 'he is', 'he has'],
  "don't": ['dont', 'do not'],
}

// ============ 合并词等效映射 ============
// 处理 "everyday" vs "every day", "alot" vs "a lot" 等
const MERGED_WORD_EQUIVALENTS: Record<string, string[]> = {
  "everyday": ['every day'],
  "every day": ['everyday'],
  " alot": ['a lot'],
  "infact": ['in fact'],
  "alright": ['all right'],
  "ok": ['okay'],
  "gotta": ['got to'],
  "kinda": ['kind of'],
  "sorta": ['sort of'],
  "wanna": ['want to'],
  "gonna": ['going to'],
  "gimme": ['give me'],
  "lemme": ['let me'],
  "dunno": ['dont know', 'do not know'],
  "cuz": ['because'],
  "cause": ['because'],
  "tho": ['though'],
  "thru": ['through'],
  "till": ['until'],
}

// ============ Metaphone 算法实现（简化版）============
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

// ============ 高频误判词对（STT 常见混淆）- 扩展版 ============
const HIGH_FREQUENCY_MISHEARS: Record<string, string[]> = {
  // 功能词（可以省略）
  'a': ['', 'an', 'the'],
  'an': ['', 'a', 'the'],
  'the': ['', 'a', 'an'],
  'of': ['', 'off'],
  'to': ['', 'too', ''],
  'in': ['', 'on', 'at'],
  'on': ['', 'in', 'at'],
  'at': ['', 'in', 'on'],
  'with': ['', 'without'],
  'by': ['', 'my'],
  'from': ['', 'for'],

  // 连接词（可以省略）
  'and': ['', 'end'],
  'but': ['', 'yet'],
  'or': ['', 'nor'],
  'so': ['', 'such'],
  'for': ['', 'four'],

  // 代词（可以省略或替换）
  'they': ['', 'them', 'their', 'there'],
  'them': ['', 'they', 'their'],
  'their': ['', 'there', 'them', 'they'],
  'there': ['', 'their', 'where', 'were'],
  'where': ['', 'were', 'there', 'were'],
  'were': ['', 'are', 'was', 'their', 'there'],

  // 助动词（可以省略）
  'was': ['', 'were', 'is', 'are'],
  'are': ['', 'is', 'was', 'were'],
  'is': ['', 'was', 'were', 'this', 'it'],

  // 动词
  'said': ['', 'say', 'says'],
  'say': ['', 'said', 'saying'],

  // 形容词（可以省略）
  'very': ['', 'really'],
  'really': ['', 'very'],
  'quite': ['', 'very', 'really'],

  // 核心词汇（必须匹配）
  'pig': ['peak', 'pik', 'pig', 'peaks', 'big', 'picked', 'pick'],
  'peaks': ['pig', 'peak', 'pigs'],
  'pick': ['pig', 'picked', 'peak'],
  'picked': ['pig', 'pick', 'peak'],
  'peak': ['pig', 'peaks', 'peek'],
  'little': ['small', 'tiny'],
  'three': ['tree', 'free'],
  'mother': ['other', 'murder'],
  'brothers': ['brother'],
  'brother': ['brothers'],
  'got': ['get', 'gotten'],
  'get': ['got', 'gotten'],
  'well': ['good', 'fine'],

  // 数字
  'one': ['', 'won', '1'],
  'two': ['', 'to', 'too'],
  'first': [''],
  'second': [''],
  'third': [''],
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
 * 智能匹配两个单词 - "口语优先"容错版本
 * 核心理念：只要发音在合理范围内，一律判定为正确
 *
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
  const normalize = (w: string) => w.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const target = normalize(targetWord)
  const spoken = normalize(spokenWord)

  console.log(`[MATCH] Checking "${target}" vs "${spoken}"`)

  // 0. 检查缩写/合并词等效映射（we've → we, everyday → every day）
  // 优先级最高，因为这是用户主动选择的表达方式
  const targetContractions = CONTRACTION_EQUIVALENTS[target] || []
  if (targetContractions.includes(spoken)) {
    console.log(`[MATCH] ✓ CONTRACTION match: "${target}" ≈ "${spoken}"`)
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Contraction equivalent (e.g., "we\'ve" → "we")'
    }
  }

  const spokenContractions = CONTRACTION_EQUIVALENTS[spoken] || []
  if (spokenContractions.includes(target)) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Contraction equivalent (e.g., "we" → "we\'ve")'
    }
  }

  const targetMerged = MERGED_WORD_EQUIVALENTS[target] || []
  if (targetMerged.includes(spoken)) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Merged word equivalent (e.g., "everyday" ↔ "every day")'
    }
  }

  // 1. 精确匹配
  if (target === spoken) {
    console.log(`[MATCH] ✓ EXACT match: "${target}" == "${spoken}"`)
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Exact match'
    }
  }

  // 2. 检查高频误判词表（扩展版，包含更多常见混淆）
  const mishears = HIGH_FREQUENCY_MISHEARS[target] || []
  console.log(`[MATCH] Checking HIGH_FREQUENCY_MISHEARS for "${target}":`, mishears)
  if (mishears.includes(spoken)) {
    console.log(`[MATCH] ✓ HIGH_FREQUENCY_MISHEARS match: "${target}" → ["${spoken}"]`)
    return {
      isMatch: true,
      confidence: 0.90,
      matchType: 'fuzzy',
      reason: 'High-frequency mishear pair (STT error correction)'
    }
  }

  // 反向检查：用户说的词可能对应多个目标词
  for (const [key, values] of Object.entries(HIGH_FREQUENCY_MISHEARS)) {
    if (values.includes(spoken) && (key === target || values.includes(target))) {
      console.log(`[MATCH] ✓ REVERSE match: "${spoken}" in ${key}'s values [${values.join(', ')}]`)
      return {
        isMatch: true,
        confidence: 0.88,
        matchType: 'fuzzy',
        reason: 'High-frequency mishear pair (reverse match)'
      }
    }
  }

  // 3. Metaphone 语音相似度检测（降低阈值，提高容错）
  const targetMetaphone = metaphone(target)
  const spokenMetaphone = metaphone(spoken)
  const metaphoneSimilarity = calculateMetaphoneSimilarity(targetMetaphone, spokenMetaphone)

  console.log(`[MATCH] Metaphone: "${target}"→"${targetMetaphone}", "${spoken}"→"${spokenMetaphone}", similarity=${(metaphoneSimilarity * 100).toFixed(0)}%`)

  // 降低阈值从 0.6 → 0.4，接受更多语音相似的词
  if (metaphoneSimilarity >= 0.4) {
    console.log(`[MATCH] ✓ METAPHONE match: ${(metaphoneSimilarity * 100).toFixed(0)}% >= 40%`)
    return {
      isMatch: true,
      confidence: 0.85,
      matchType: 'metaphone',
      reason: `Metaphone similarity ${(metaphoneSimilarity * 100).toFixed(0)}%`
    }
  }

  // 4. 编辑距离容错（放宽条件）
  const editDistance = calculateEditDistance(target, spoken)
  const maxLen = Math.max(target.length, spoken.length)
  const similarity = (maxLen - editDistance) / maxLen

  // 容错2个字符，相似度 >= 0.5（从0.6降低到0.5）
  if (editDistance <= 2 && similarity >= 0.5) {
    return {
      isMatch: true,
      confidence: 0.75,
      matchType: 'fuzzy',
      reason: `Edit distance ${editDistance}, similarity ${(similarity * 100).toFixed(0)}%`
    }
  }

  // 5. 上下文感知匹配（基于 N-gram 概率）
  if (contextWords && contextWords.length > 0) {
    for (const [ctxTarget, ctxSpoken, weight] of CONTEXTUAL_PAIRS) {
      if (target === ctxTarget && spoken === ctxSpoken) {
        const contextScore = calculateContextProbability(target, spoken, contextWords)

        if (contextScore >= 0.5) {  // 降低阈值从 0.7 → 0.5
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

  // 6. 核心元音匹配（宽松判定）
  const targetVowels = target.replace(/[^aeiou]/g, '')
  const spokenVowels = spoken.replace(/[^aeiou]/g, '')

  if (targetVowels === spokenVowels && targetVowels.length > 0) {
    return {
      isMatch: true,
      confidence: 0.70,  // 提高从 0.65 → 0.70
      matchType: 'fuzzy',
      reason: 'Core vowels match (spoken-first tolerance)'
    }
  }

  // 7. 辅音丢失检测（扩展规则）
  if (isConsonantDrop(target, spoken) || isConsonantDrop(spoken, target)) {
    return {
      isMatch: true,
      confidence: 0.75,  // 提高从 0.70 → 0.75
      matchType: 'fuzzy',
      reason: 'Consonant drop detected (common speaking variation)'
    }
  }

  // 8. 词尾 s/es/ed/ing 丢失（放宽条件）
  if (target.endsWith('s') && spoken === target.slice(0, -1)) {
    return {
      isMatch: true,
      confidence: 0.85,  // 提高从 0.80 → 0.85
      matchType: 'fuzzy',
      reason: 'Plural/present tense -s dropped'
    }
  }

  if (target.endsWith('es') && spoken === target.slice(0, -2)) {
    return {
      isMatch: true,
      confidence: 0.85,
      matchType: 'fuzzy',
      reason: 'Verb ending -es dropped'
    }
  }

  if (target.endsWith('ed') && spoken === target.slice(0, -2)) {
    return {
      isMatch: true,
      confidence: 0.82,
      matchType: 'fuzzy',
      reason: 'Verb ending -ed dropped (common STT error)'
    }
  }

  if (target.endsWith('ing') && spoken === target.slice(0, -3) + 'in') {
    return {
      isMatch: true,
      confidence: 0.80,
      matchType: 'fuzzy',
      reason: 'Verb ending -ing → -in (common informal speech)'
    }
  }

  // 9. STT 误判：首字母混淆（如 p/b, t/d, k/g）
  if (isInitialConsonantConfusion(target, spoken)) {
    return {
      isMatch: true,
      confidence: 0.72,
      matchType: 'fuzzy',
      reason: 'Initial consonant confusion (STT error)'
    }
  }

  // 9.5. 检查是否是基础词 + ed 的误读（如 pig → picked, pick → picked）
  if (spoken.endsWith('ed') && target === spoken.slice(0, -2)) {
    console.log(`[MATCH] ✓ Base + ed match: "${target}" ← "${spoken}"`)
    return {
      isMatch: true,
      confidence: 0.82,
      matchType: 'fuzzy',
      reason: 'Base word with extra -ed (common STT error)'
    }
  }

  if (target.endsWith('ed') && spoken === target.slice(0, -2)) {
    console.log(`[MATCH] ✓ Base + ed match: "${target}" → "${spoken}"`)
    return {
      isMatch: true,
      confidence: 0.82,
      matchType: 'fuzzy',
      reason: 'Base word with -ed dropped'
    }
  }

  // 10. 词尾辅音混淆（如 d/t, k/ck）
  if (isFinalConsonantConfusion(target, spoken)) {
    return {
      isMatch: true,
      confidence: 0.72,
      matchType: 'fuzzy',
      reason: 'Final consonant confusion (common speaking variation)'
    }
  }

  // 最后的兜底：如果长度差异 <= 1 且有 50% 字符相同，算部分正确
  if (Math.abs(target.length - spoken.length) <= 1 && similarity >= 0.5) {
    console.log(`[MATCH] ✓ PARTIAL match: len diff=${Math.abs(target.length - spoken.length)}, similarity=${(similarity * 100).toFixed(0)}%`)
    return {
      isMatch: true,
      confidence: 0.60,
      matchType: 'fuzzy',
      reason: 'Partial match (spoken-first leniency)'
    }
  }

  // 仍然不匹配（但返回更友好的提示）
  console.log(`[MATCH] ✗ NO MATCH for "${target}" vs "${spoken}"`)
  return {
    isMatch: false,
    confidence: 0,
    matchType: 'no_match',
    reason: 'No significant similarity found'
  }
}

// 计算编辑距离
function calculateEditDistance(a: string, b: string): number {
  const dp: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    dp[i] = []
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) dp[i][j] = j
      else if (j === 0) dp[i][j] = i
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // 删除
          dp[i][j - 1] + 1,      // 插入
          dp[i - 1][j - 1] + cost // 替换
        )
      }
    }
  }
  return dp[a.length][b.length]
}

// 检查首字母混淆（p/b, t/d, k/g, f/v, s/z, etc.）
function isInitialConsonantConfusion(target: string, spoken: string): boolean {
  if (target.length < 2 || spoken.length < 2) return false

  const confusionPairs: Array<[string, string]> = [
    ['p', 'b'], ['b', 'p'],
    ['t', 'd'], ['d', 't'],
    ['k', 'g'], ['g', 'k'],
    ['f', 'v'], ['v', 'f'],
    ['s', 'z'], ['z', 's'],
    ['th', 'd'], ['d', 'th'],
    ['th', 't'], ['t', 'th'],
    ['h', ''], ['h', ''],
  ]

  const targetRest = target.slice(1)
  const spokenRest = spoken.slice(1)

  // 如果除了首字母外都相同，检查首字母是否是混淆对
  if (targetRest === spokenRest) {
    const targetInit = target[0]
    const spokenInit = spoken[0]
    for (const [a, b] of confusionPairs) {
      if ((targetInit === a && spokenInit === b) || (targetInit === b && spokenInit === a)) {
        return true
      }
    }
  }

  return false
}

// 检查词尾辅音混淆（d/t, k/ck, etc.）
function isFinalConsonantConfusion(target: string, spoken: string): boolean {
  if (target.length < 2 || spoken.length < 2) return false

  const targetBase = target.slice(0, -1)
  const spokenBase = spoken.slice(0, -1)

  // 如果除了最后一个字母外都相同
  if (targetBase === spokenBase) {
    const targetEnd = target[target.length - 1]
    const spokenEnd = spoken[spoken.length - 1]

    // 词尾 d/t 混淆
    if ((targetEnd === 'd' && spokenEnd === 't') || (targetEnd === 't' && spokenEnd === 'd')) {
      return true
    }
    // 词尾 k/ck 混淆（已经通过其他规则处理）
    // 词尾 s/z 混淆
    if ((targetEnd === 's' && spokenEnd === 'z') || (targetEnd === 'z' && spokenEnd === 's')) {
      return true
    }
  }

  return false
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
