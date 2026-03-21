"use client"

import { useState, useEffect, useRef } from "react"
import { useSuccessSound } from "@/hooks/useSuccessSound"
import { intelligentMatch } from "@/lib/audio-checker"
import { TranslationLanguageSelector, type TranslationLanguage } from "@/components/TranslationLanguageSelector"
import type { Sentence, Translation } from "@/types"

interface ShadowingPanelProps {
  sentence: Sentence
  audioSrc?: string  // 可选：音频源（R2 素材使用，YouTube 素材不需要）
  currentTime?: number  // 当前播放时间（用于确定显示哪个子句）
  onComplete?: (isCorrect: boolean, durationSeconds: number) => void
  onNext?: () => void
  isLastSentence?: boolean
  translationLanguage?: TranslationLanguage
  showTranslation?: boolean
  onTranslationLanguageChange?: (language: TranslationLanguage, showTranslation: boolean) => void
}

// 单词对比结果类型
interface WordDiff {
  word: string           // 单词原文
  status: 'match' | 'insertion' | 'deletion' | 'weak_link' | 'partial_match'  // 匹配 | 多读 | 漏读 | 连读弱读 | 整句通过但该词读错
  originalIndex?: number // 在原句中的位置（用于漏读词）
}

// 连读虚词列表
const LINKING_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'from',
  'with', 'by', 'as', 'is', 'it', 'this', 'that', 'are', 'was', 'were'
])

// 固定音量（与 AudioPlayer 保持一致）
const getSavedVolume = (): number => {
  return 0.25 // 固定 0.25（温和适中）
}

// 连读组合接口
interface LinkingPair {
  first: string
  second: string
  combined: string
  pattern: string
  ipa: string  // 连读后的音标
}

/**
 * 检测句子中的连读组合
 * 只返回最重要的连读组合（t/d + 元音）
 */
const detectLinkingPairs = (sentence: string): LinkingPair[] => {
  const words = sentence.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0)
  const pairs: LinkingPair[] = []

  // 只检测最明显的连读：t/d/ed + 元音
  for (let i = 0; i < words.length - 1; i++) {
    const first = words[i]
    const second = words[i + 1]

    // 只检测 t/d/ed 结尾 + 元音开头
    if ((first.endsWith('t') || first.endsWith('d') || first.endsWith('ed')) && isVowelStart(second)) {
      const ipa = generateLinkingIPA(first, second)

      pairs.push({
        first,
        second,
        combined: `${first}-${second}`,
        pattern: '辅音+元音',
        ipa
      })
    }
  }

  // 只返回第 1 个最重要的连读组合
  return pairs.slice(0, 1)
}

// 判断是否元音开头
const isVowelStart = (word: string): boolean => {
  const vowels = ['a', 'e', 'i', 'o', 'u']
  return vowels.some(v => word.startsWith(v))
}

// 判断是否辅音结尾
const isConsonantEnd = (word: string): boolean => {
  const vowels = ['a', 'e', 'i', 'o', 'u']
  const lastChar = word.slice(-1)
  return !vowels.includes(lastChar) && lastChar.match(/[a-z]/i) !== null
}

// 判断是否半元音开头（y/j/w）
const isSemiVowelStart = (word: string): boolean => {
  return word.startsWith('y') || word.startsWith('j') || word.startsWith('w')
}

// 常见近音词/易混淆词映射
const SIMILAR_SOUNDING_WORDS: Record<string, string[]> = {
  'he': ['she', 'he', 'e'],
  'she': ['he', 'she'],
  'there': ['their', 'there', 'they\'re'],
  'their': ['there', 'their'],
  'were': ['where', 'were', 'we\'re'],
  'where': ['were', 'where'],
  'our': ['are', 'our', 'hour'],
  'are': ['our', 'are'],
  'your': ['you\'re', 'your', 'you'],
  'you\'re': ['your', 'you\'re', 'you'],
  'it\'s': ['its', 'it\'s', 'is'],
  'its': ['it\'s', 'its'],
  'here': ['hear', 'here'],
  'hear': ['here', 'hear'],
  'know': ['no', 'know'],
  'no': ['know', 'no'],
  'write': ['right', 'write', 'ride'],
  'right': ['write', 'right'],
  'see': ['sea', 'see'],
  'sea': ['see', 'sea'],
  'sun': ['son', 'sun'],
  'son': ['sun', 'son'],
}

// 检查两个词是否发音相似
const areSimilarSounding = (word1: string, word2: string): boolean => {
  const w1 = word1.toLowerCase()
  const w2 = word2.toLowerCase()

  // 完全相同
  if (w1 === w2) return true

  // 检查近音词映射
  const similarWords1 = SIMILAR_SOUNDING_WORDS[w1] || []
  const similarWords2 = SIMILAR_SOUNDING_WORDS[w2] || []

  if (similarWords1.includes(w2)) return true
  if (similarWords2.includes(w1)) return true

  // 编辑距离判断（容错1个字符）
  const editDistance = (a: string, b: string): number => {
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

  return editDistance(w1, w2) <= 1
}

// 常见词的音标字典（简化版）
const COMMON_IPA: Record<string, string> = {
  // 代词
  'i': '/aɪ/', 'you': '/juː/', 'he': '/hiː/', 'she': '/ʃiː/', 'it': '/ɪt/',
  'we': '/wiː/', 'they': '/ðeɪ/', 'them': '/ðem/', 'him': '/hɪm/', 'her': '/hɜː/',
  'me': '/miː/', 'my': '/maɪ/', 'your': '/jɔː/', 'his': '/hɪz/', 'its': '/ɪts/',

  // 冠词和介词
  'a': '/ə/', 'an': '/ən/', 'the': '/ðə/',
  'at': '/æt/', 'in': '/ɪn/', 'on': '/ɒn/', 'for': '/fɔː/', 'to': '/tuː/',
  'of': '/ɒv/', 'from': '/frɒm/', 'with': '/wɪð/', 'by': '/baɪ/', 'as': '/æz/',
  'about': '/əˈbaʊt/', 'after': '/ˈɑːftə/', 'all': '/ɔːl/', 'and': '/ænd/',

  // 动词（常用过去式）
  'looked': '/lʊkt/', 'laughed': '/lɑːft/', 'wanted': '/ˈwɒntɪd/', 'needed': '/ˈniːdɪd/',
  'played': '/pleɪd/', 'started': '/ˈstɑːtɪd/', 'ended': '/ˈendɪd/', 'asked': '/ɑːskt/',
  'walked': '/wɔːkt/', 'talked': '/tɔːkt/', 'worked': '/wɜːkt/', 'called': '/kɔːld/',
  'stopped': '/stɒpt/', 'watched': '/wɒtʃt/', 'washed': '/wɒʃt/', 'used': '/juːzd/',

  // 常用形容词
  'good': '/gʊd/', 'bad': '/bæd/', 'hard': '/hɑːd/', 'soft': '/sɒft/',

  // 其他常用词
  'not': '/nɒt/', 'but': '/bʌt/', 'or': '/ɔː/', 'so': '/səʊ/', 'out': '/aʊt/',
  'up': '/ʌp/', 'down': '/daʊn/', 'back': '/bæk/', 'over': '/ˈəʊvə/',
  'john': '/dʒɒn/', 'tom': '/tɒm/', 'when': '/wen/', 'then': '/ðen/',
}

// 获取单词的音标（如果有）
const getWordIPA = (word: string): string | null => {
  return COMMON_IPA[word.toLowerCase()] || null
}

// 生成连读音标
const generateLinkingIPA = (first: string, second: string): string => {
  const firstIPA = getWordIPA(first)
  const secondIPA = getWordIPA(second)

  if (!firstIPA || !secondIPA) {
    return ''  // 没有音标数据
  }

  // 去掉音标的斜杠，便于合并
  const firstSound = firstIPA.replace(/\//g, '').replace(/ː/g, '')
  const secondSound = secondIPA.replace(/\//g, '').replace(/ː/g, '')

  // 连读规则：辅音结尾 + 元音开头，直接合并
  // 例如：/lʊkt/ + /æt/ → /lʊktæt/
  return `/${firstSound}${secondSound}/`
}

export default function ShadowingPanel({
  sentence,
  audioSrc,
  currentTime,
  onComplete,
  onNext,
  isLastSentence,
  translationLanguage: externalTranslationLanguage,
  showTranslation: externalShowTranslation,
  onTranslationLanguageChange
}: ShadowingPanelProps) {
  const { playSuccessSound } = useSuccessSound() // 使用全局静音状态
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [userTranscript, setUserTranscript] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [wordDiffs, setWordDiffs] = useState<WordDiff[]>([])  // 单词对比结果
  const [sentenceSimilarity, setSentenceSimilarity] = useState<number>(0)  // 句子相似度
  const [wordMatchRate, setWordMatchRate] = useState<number>(0)  // 单词匹配率

  // 翻译语言状态管理
  const [internalTranslationLanguage, setInternalTranslationLanguage] = useState<TranslationLanguage>('zh')
  const [internalShowTranslation, setInternalShowTranslation] = useState(false)

  // 使用外部翻译语言状态（如果提供），否则使用内部状态
  const translationLanguage = externalTranslationLanguage ?? internalTranslationLanguage
  const showTranslation = externalShowTranslation ?? internalShowTranslation

  // 显示控制模式
  type DisplayMode = 'full' | 'translation-only' | 'blind'
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full')  // full: 显示原句+释义, translation-only: 只显示释义, blind: 完全隐藏

  // 处理翻译语言变化
  const handleLanguageChange = (language: TranslationLanguage, show: boolean) => {
    setInternalTranslationLanguage(language)
    setInternalShowTranslation(show)
    onTranslationLanguageChange?.(language, show)
  }

  // 获取当前语言的翻译文本
  const getCurrentTranslation = (): string => {
    if (!sentence.translation) return ''

    // 向后兼容：支持旧的 string 格式
    if (typeof sentence.translation === 'string') {
      return sentence.translation
    }

    // 新的 Translation JSONB 格式
    return sentence.translation[translationLanguage] || ''
  }

  const currentTranslation = getCurrentTranslation()

  // 获取语言标签
  const getLanguageLabel = (lang: TranslationLanguage): string => {
    const labels = {
      'zh': '中文 (简体)',
      'zh_hant': '中文 (繁體)',
      'vi': 'Tiếng Việt',
      'hide': ''
    }
    return labels[lang] || ''
  }

  const languageLabel = getLanguageLabel(translationLanguage)

  // 兜底时间跟踪：页面停留时间
  const [pageStartTime, setPageStartTime] = useState<number | null>(null)

  // 真实音频播放时间跟踪
  const [totalPlayedSeconds, setTotalPlayedSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const totalPlayedSecondsRef = useRef<number>(0)

  // 录音相关
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const originalAudioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const sentenceRef = useRef(sentence)
  const onCompleteRef = useRef(onComplete)
  const userTranscriptRef = useRef(userTranscript)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordedMimeTypeRef = useRef<string>('')
  const resultProcessedRef = useRef(false)  // Track if we've already processed the result
  const successSoundPlayedRef = useRef(false)  // 防止成功音效重复播放

  // 更新 refs 当值变化时
  useEffect(() => {
    sentenceRef.current = sentence
  }, [sentence])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    userTranscriptRef.current = userTranscript
  }, [userTranscript])

  // 初始化 originalAudioRef 音量（与全局音量保持一致）
  useEffect(() => {
    if (originalAudioRef.current) {
      const volume = getSavedVolume()
      originalAudioRef.current.volume = volume
      console.log('ShadowingPanel - Initial originalAudioRef volume set to:', volume)
    }
  }, [originalAudioRef])

  // 初始化 audioRef 音量（与全局音量保持一致）
  useEffect(() => {
    if (audioRef.current) {
      const volume = getSavedVolume()
      audioRef.current.volume = volume
      console.log('ShadowingPanel - Initial audioRef volume set to:', volume)
    }
  }, [audioRef])

  // Track showResult changes for debugging
  useEffect(() => {
    console.log("showResult changed to:", showResult)
  }, [showResult])

  useEffect(() => {
    console.log("useEffect fired for sentence.id:", sentence.id)
    setUserTranscript("")
    setShowResult(false)
    console.log("Reset showResult to false")
    setRecordedAudioUrl(null)
    setMicError(null)
    setWordDiffs([])  // 重置单词对比结果
    setSentenceSimilarity(0)  // 重置句子相似度
    setWordMatchRate(0)  // 重置单词匹配率
    // 不重置 displayMode，保持用户选择
    recordedChunksRef.current = []
    resultProcessedRef.current = false  // Reset result processed flag
    successSoundPlayedRef.current = false  // Reset success sound played flag

    // 重置播放时间跟踪
    setTotalPlayedSeconds(0)
    totalPlayedSecondsRef.current = 0
    setIsPlaying(false)

    // 清理之前的音频事件监听器
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    // 停止音频播放
    if (originalAudioRef.current) {
      originalAudioRef.current.pause()
    }

    // 记录页面开始时间（兜底逻辑）
    const now = Date.now()
    setPageStartTime(now)
    console.log("Set pageStartTime to:", now)
  }, [sentence.id])

  /**
   * 文本预处理标准化（增强版）
   * - 全部转为小写
   * - 移除所有标点符号
   * - 连字符替换为空格
   * - 数字统一转换为数字形式（0-9）
   * - 移除首尾空格，合并连续空格
   */
  const normalizeText = (text: string): string => {
    // 数字转换单词映射
    const numberWords: Record<string, string> = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
      'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
      'eighteen': '18', 'nineteen': '19', 'twenty': '20'
    }

    let normalized = text
      .toLowerCase()
      .replace(/-/g, ' ')        // 连字符替换为空格
      .replace(/[^\w\s]/g, '')   // 移除所有标点符号
      .replace(/\s+/g, ' ')      // 合并连续空格
      .trim()

    // 转换数字单词为数字
    const words = normalized.split(' ')
    const convertedWords = words.map(word => {
      if (numberWords[word]) {
        return numberWords[word]
      }
      return word
    })

    return convertedWords.join(' ')
  }

  /**
   * 计算 Levenshtein Distance（编辑距离）
   * 返回两个字符串之间的编辑距离
   */
  const calculateLevenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length
    const n = str2.length
    const dp: number[][] = []

    for (let i = 0; i <= m; i++) {
      dp[i] = []
      for (let j = 0; j <= n; j++) {
        if (i === 0) dp[i][j] = j
        else if (j === 0) dp[i][j] = i
        else {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,       // 删除
            dp[i][j - 1] + 1,       // 插入
            dp[i - 1][j - 1] + cost // 替换
          )
        }
      }
    }

    return dp[m][n]
  }

  /**
   * 计算两个文本的相似度（基于 Levenshtein Distance）
   * 返回 0-1 之间的相似度分数
   */
  const calculateSimilarity = (text1: string, text2: string): number => {
    const normalized1 = normalizeText(text1)
    const normalized2 = normalizeText(text2)

    if (normalized1.length === 0 && normalized2.length === 0) return 1.0
    if (normalized1.length === 0 || normalized2.length === 0) return 0.0

    const distance = calculateLevenshteinDistance(normalized1, normalized2)
    const maxLen = Math.max(normalized1.length, normalized2.length)
    const similarity = (maxLen - distance) / maxLen

    console.log(`[SIMILARITY] "${normalized1}" vs "${normalized2}": distance=${distance}, similarity=${(similarity * 100).toFixed(1)}%`)

    return similarity
  }

  /**
   * 检测专有名词（人名、地名等）
   * 规则：首字母大写 且 不在常用词表中
   */
  const isProperNoun = (word: string): boolean => {
    if (!word || word.length < 2) return false

    // 检查是否首字母大写
    const isFirstCapital = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()

    // 常用非专有名词列表（句首可能大写但不是专有名词）
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'with', 'by', 'from', 'of', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
      'its', 'our', 'their', 'me', 'him', 'them', 'us'
    ])

    const lowerWord = word.toLowerCase()

    // 如果是常用词，不是专有名词
    if (commonWords.has(lowerWord)) return false

    // 首字母大写，且长度 > 1，很可能是专有名词
    return isFirstCapital
  }

  /**
   * 从句子中提取专有名词列表
   */
  const extractProperNouns = (sentence: string): Set<string> => {
    const words = sentence.split(/\s+/)
    const properNouns = new Set<string>()

    for (const word of words) {
      // 清理标点
      const cleanWord = word.replace(/[^\w\s]/g, '')
      if (isProperNoun(cleanWord)) {
        properNouns.add(cleanWord.toLowerCase())
      }
    }

    return properNouns
  }

  /**
   * 单词级对比算法 - 贪婪匹配/锚点对齐版本
   *
   * 核心改进：
   * 1. 不再使用死板的 A[i] vs B[i] 索引比对
   * 2. 对每个原文单词，在识别结果中全局搜索匹配
   * 3. 允许跳跃匹配（跳过脏数据）
   * 4. 关键词保护（核心词必须匹配）
   */
  const compareWords = (originalText: string, recognizedText: string): WordDiff[] => {
    console.log("===== compareWords called (Greedy Matching) =====")
    console.log("Original text:", originalText)
    console.log("Recognized text:", recognizedText)

    const originalWords = normalizeText(originalText).split(' ').filter(w => w.length > 0)
    const recognizedWords = normalizeText(recognizedText).split(' ').filter(w => w.length > 0)

    // 提取专有名词白名单
    const properNounWhitelist = extractProperNouns(originalText)
    console.log("Proper noun whitelist:", Array.from(properNounWhitelist))

    // 核心词列表（长度 >= 4 的名词、动词、形容词）
    const contentWords = originalWords.filter(w => w.length >= 4 && !LINKING_WORDS.has(w.toLowerCase()))
    console.log("Content words (keywords):", contentWords)

    console.log("Normalized original words:", originalWords)
    console.log("Normalized recognized words:", recognizedWords)
    console.log("==============================")

    // 初始化所有原文单词为未匹配状态
    const matchStatus: Array<'match' | 'weak_link' | 'deletion'> = new Array(originalWords.length).fill('deletion')
    const matchedOriginalIndices = new Set<number>()  // 已匹配的原文单词索引
    const matchedRecognizedIndices = new Set<number>()  // 已匹配的识别单词索引

    // 第一轮：核心词优先匹配（锚点对齐）
    console.log("\n=== Round 1: Keyword Matching (Anchor Alignment) ===")
    for (let i = 0; i < originalWords.length; i++) {
      if (matchedOriginalIndices.has(i)) continue  // 已匹配，跳过

      const originalWord = originalWords[i]
      const isKeyword = contentWords.includes(originalWord)
      const isProperNoun = properNounWhitelist.has(originalWord.toLowerCase())

      // 优先匹配核心词和专有名词
      if (!isKeyword && !isProperNoun) continue

      console.log(`[KEYWORD] Looking for "${originalWord}" (index ${i})`)

      // 在识别结果中全局搜索这个词
      let bestMatchIndex = -1
      let bestMatchScore = 0

      for (let j = 0; j < recognizedWords.length; j++) {
        if (matchedRecognizedIndices.has(j)) continue  // 已匹配，跳过

        const recognizedWord = recognizedWords[j]
        const context = originalWords.slice(Math.max(0, i - 1), i + 2)
        const matchResult = intelligentMatch(originalWord, recognizedWord, context)

        if (matchResult.isMatch && matchResult.confidence > bestMatchScore) {
          bestMatchIndex = j
          bestMatchScore = matchResult.confidence
        }
      }

      // 如果找到匹配（置信度 >= 40%）
      if (bestMatchIndex !== -1 && bestMatchScore >= 0.40) {
        console.log(`[KEYWORD] ✓ Matched "${originalWord}" with "${recognizedWords[bestMatchIndex]}" (confidence: ${(bestMatchScore * 100).toFixed(0)}%)`)

        matchStatus[i] = bestMatchScore >= 0.85 ? 'match' : 'weak_link'
        matchedOriginalIndices.add(i)
        matchedRecognizedIndices.add(bestMatchIndex)
      } else {
        console.log(`[KEYWORD] ✗ No match found for "${originalWord}"`)
      }
    }

    // 第二轮：剩余词贪婪匹配（允许跳跃）
    console.log("\n=== Round 2: Greedy Matching (Skip Allowed) ===")
    for (let i = 0; i < originalWords.length; i++) {
      if (matchedOriginalIndices.has(i)) continue  // 已匹配，跳过

      const originalWord = originalWords[i]
      console.log(`[GREEDY] Looking for "${originalWord}" (index ${i})`)

      // 在识别结果中搜索这个词（只看未匹配的）
      let bestMatchIndex = -1
      let bestMatchScore = 0
      let bestPosition = Infinity  // 位置接近度

      for (let j = 0; j < recognizedWords.length; j++) {
        if (matchedRecognizedIndices.has(j)) continue  // 已匹配，跳过

        const recognizedWord = recognizedWords[j]
        const context = originalWords.slice(Math.max(0, i - 1), i + 2)
        const matchResult = intelligentMatch(originalWord, recognizedWord, context)

        if (matchResult.isMatch && matchResult.confidence >= 0.40) {
          // 计算位置接近度（优先匹配位置相近的）
          const positionDiff = Math.abs(j - i)

          // 选择最佳匹配：优先高置信度，其次位置接近
          const isBetter = matchResult.confidence > bestMatchScore ||
                         (matchResult.confidence === bestMatchScore && positionDiff < bestPosition)

          if (isBetter) {
            bestMatchIndex = j
            bestMatchScore = matchResult.confidence
            bestPosition = positionDiff
          }
        }
      }

      // 如果找到匹配
      if (bestMatchIndex !== -1) {
        console.log(`[GREEDY] ✓ Matched "${originalWord}" with "${recognizedWords[bestMatchIndex]}" (confidence: ${(bestMatchScore * 100).toFixed(0)}%, position: ${bestPosition})`)

        matchStatus[i] = bestMatchScore >= 0.85 ? 'match' : 'weak_link'
        matchedOriginalIndices.add(i)
        matchedRecognizedIndices.add(bestMatchIndex)
      } else {
        console.log(`[GREEDY] ✗ No match found for "${originalWord}"`)
        matchStatus[i] = 'deletion'  // 暂时标记为漏读，可能在连读合并中匹配
      }
    }

    // 第三轮：连读合并探测（Linking Merge Detection）
    console.log("\n=== Round 3: Linking Merge Detection ===")
    const SHORT_WORD_MAX_LENGTH = 3  // 短词定义：长度 ≤ 3

    // 找出所有未匹配的短词
    const unmatchedShortWords: Array<{ word: string; index: number }> = []
    for (let i = 0; i < originalWords.length; i++) {
      if (!matchedOriginalIndices.has(i) && originalWords[i].length <= SHORT_WORD_MAX_LENGTH) {
        unmatchedShortWords.push({ word: originalWords[i], index: i })
      }
    }

    console.log("Unmatched short words:", unmatchedShortWords)

    // 检测相邻的未匹配短词对，尝试合并匹配
    for (let k = 0; k < unmatchedShortWords.length - 1; k++) {
      const first = unmatchedShortWords[k]
      const second = unmatchedShortWords[k + 1]

      // 检查是否相邻（索引差为 1）
      if (second.index - first.index !== 1) continue

      // 合并两个词
      const mergedWord = first.word + second.word
      console.log(`[LINKING MERGE] Trying merged word: "${first.word}" + "${second.word}" → "${mergedWord}"`)

      // 在识别结果中搜索合并后的词
      let bestMatchIndex = -1
      let bestMatchScore = 0

      for (let j = 0; j < recognizedWords.length; j++) {
        if (matchedRecognizedIndices.has(j)) continue

        const recognizedWord = recognizedWords[j]
        const context = originalWords.slice(Math.max(0, first.index - 1), second.index + 2)
        const matchResult = intelligentMatch(mergedWord, recognizedWord, context)

        if (matchResult.isMatch && matchResult.confidence >= 0.50) {
          if (matchResult.confidence > bestMatchScore) {
            bestMatchIndex = j
            bestMatchScore = matchResult.confidence
          }
        }
      }

      // 如果找到匹配
      if (bestMatchIndex !== -1) {
        console.log(`[LINKING MERGE] ✓ Found merged word "${mergedWord}" → "${recognizedWords[bestMatchIndex]}" (confidence: ${(bestMatchScore * 100).toFixed(0)}%)`)

        // 标记两个词为匹配
        matchStatus[first.index] = bestMatchScore >= 0.85 ? 'match' : 'weak_link'
        matchStatus[second.index] = bestMatchScore >= 0.85 ? 'match' : 'weak_link'
        matchedOriginalIndices.add(first.index)
        matchedOriginalIndices.add(second.index)
        matchedRecognizedIndices.add(bestMatchIndex)
      }
    }

    // 生成 diffs：只显示原文，读错的词变色
    const diffs: WordDiff[] = []
    for (let i = 0; i < originalWords.length; i++) {
      diffs.push({
        word: originalWords[i],
        status: matchStatus[i],
        originalIndex: i
      })
    }

    console.log("\n=== Final Results ===")
    console.log("Matched original indices:", Array.from(matchedOriginalIndices))
    console.log("Match status:", matchStatus)
    console.log("Word diffs:", diffs)
    console.log("==============================\n")

    return diffs
  }

  // 初始化 MediaRecorder 和 SpeechRecognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 检测支持的音频 MIME 类型
    const getSupportedMimeType = () => {
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/mp3',
        ''
      ]
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type
        }
      }
      return ''
    }

    // 初始化 MediaRecorder
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const supportedType = getSupportedMimeType()
          console.log("Supported MIME type:", supportedType || 'default')
          recordedMimeTypeRef.current = supportedType

          // iOS Safari 支持
          const options = supportedType ? { mimeType: supportedType } : undefined
          const recorder = new MediaRecorder(stream, options)
          setMediaRecorder(recorder)
          mediaRecorderRef.current = recorder

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data)
              console.log("Chunk received, total chunks:", recordedChunksRef.current.length)
            }
          }

          recorder.onstop = () => {
            console.log("Recorder stopped, chunks:", recordedChunksRef.current.length)
            if (recordedChunksRef.current.length > 0) {
              const blob = new Blob(recordedChunksRef.current, { type: recordedMimeTypeRef.current || 'audio/webm' })
              const url = URL.createObjectURL(blob)
              console.log("Created audio URL:", url)
              setRecordedAudioUrl(url)
              recordedChunksRef.current = []
            } else {
              console.error("No audio data recorded")
            }
          }

          // MediaRecorder 准备好后，初始化 SpeechRecognition
          if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
            const recog = new SpeechRecognition()
            recog.continuous = false
            recog.interimResults = true
            recog.lang = 'en-US'

            recog.onresult = (event: any) => {
              console.log("Speech recognition result event:", event)
              let interimTranscript = ''
              for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                console.log("Result:", result, "isFinal:", result.isFinal)

                // Store the transcript (both interim and final)
                interimTranscript = result[0].transcript
                userTranscriptRef.current = interimTranscript

                // 不要在 isFinal 时立即显示结果，等待用户手动停止录音
                if (result.isFinal) {
                  console.log("Final transcript received, waiting for user to stop recording:", interimTranscript)
                  resultProcessedRef.current = false  // Don't mark as processed yet
                }
              }
            }

            recog.onerror = (event: any) => {
              console.error("Speech recognition error:", event.error)
              setMicError(`语音识别错误: ${event.error}`)
              setIsRecording(false)
            }

            recog.onend = () => {
              console.log("Speech recognition ended.")
              // 不自动处理结果，等待用户手动点击停止按钮
            }

            setRecognition(recog)
            recognitionRef.current = recog
          } else {
            setMicError("您的浏览器不支持语音识别功能")
          }
        })
        .catch(err => {
          console.error("Error accessing microphone:", err)
          // 检测是否是移动设备
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          if (isMobile) {
            setMicError("移动端录音功能受限，建议使用电脑浏览器进行影子跟读练习")
          } else {
            setMicError("无法访问麦克风，请检查浏览器权限设置")
          }
        })
    } else {
      setMicError("您的浏览器不支持录音功能，建议使用最新版 Chrome 或 Edge 浏览器")
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      // 清理音频事件监听器
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      // 停止音频播放
      if (originalAudioRef.current) {
        originalAudioRef.current.pause()
      }
    }
  }, [])

  // 开始录音（语音识别 + 音频录制）
  const startRecording = () => {
    setMicError(null)
    if (!recognitionRef.current || !mediaRecorderRef.current) {
      setMicError("录音功能未初始化完成，请刷新页面重试")
      return
    }

    try {
      setUserTranscript("")
      setShowResult(false)
      setWordDiffs([])  // 重置单词对比
      setSentenceSimilarity(0)  // 重置句子相似度
      setWordMatchRate(0)  // 重置单词匹配率
      setRecordedAudioUrl(null)
      recordedChunksRef.current = []
      resultProcessedRef.current = false  // Reset result processed flag
      userTranscriptRef.current = ""  // Clear transcript ref

      // 开始语音识别
      recognitionRef.current.start()
      // 开始音频录制
      mediaRecorderRef.current.start()

      setIsRecording(true)
    } catch (err) {
      console.error("Error starting recording:", err)
      setMicError("启动录音失败，请重试")
      setIsRecording(false)
    }
  }

  // 停止录音
  const stopRecording = () => {
    console.log("stopRecording called, processing result...")

    // 停止音频录制
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop()
      } catch (err) {
        console.error("Error stopping media recorder:", err)
      }
    }

    // 停止语音识别（如果还在运行）
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        // 忽略错误（可能已经停止了）
        console.log("Speech recognition already stopped")
      }
    }

    setIsRecording(false)

    // 处理识别结果并显示"我的发音"
    const transcript = userTranscriptRef.current
    console.log("Processing transcript:", transcript)

    if (transcript && transcript.trim().length > 0) {
      console.log("Setting user transcript and showing result")
      setUserTranscript(transcript)

      // 执行单词级对比
      const diffs = compareWords(sentenceRef.current.text, transcript)
      console.log("Word diffs result:", diffs)
      setWordDiffs(diffs)

      // 计算整体正确性（使用句子级别的模糊匹配）
      // 1. 计算句子级别的相似度（Levenshtein Distance）
      const sentenceSimilarity = calculateSimilarity(sentenceRef.current.text, transcript)
      console.log("Sentence similarity:", sentenceSimilarity)

      // 2. 统计单词级别的匹配情况
      const totalWords = diffs.length
      const matchedWords = diffs.filter(d => d.status === 'match' || d.status === 'weak_link').length
      const wordMatchRate = totalWords > 0 ? matchedWords / totalWords : 0
      console.log("Word match rate:", wordMatchRate, `(${matchedWords}/${totalWords})`)

      // 3. 综合判断（句子相似度 >= 70% 或 单词匹配率 >= 70%）
      const SIMILARITY_THRESHOLD = 0.70
      const LOW_THRESHOLD = 0.50
      const isCorrect = sentenceSimilarity >= SIMILARITY_THRESHOLD || wordMatchRate >= SIMILARITY_THRESHOLD

      // 更新 state 以便渲染时使用
      setSentenceSimilarity(sentenceSimilarity)
      setWordMatchRate(wordMatchRate)

      console.log("Final judgment:", {
        sentenceSimilarity: `${(sentenceSimilarity * 100).toFixed(1)}%`,
        wordMatchRate: `${(wordMatchRate * 100).toFixed(1)}%`,
        isCorrect,
        threshold: `${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%`
      })

      console.log("Pronunciation correct:", isCorrect)

      // 延迟显示结果，确保音频录制完成
      setTimeout(() => {
        console.log("Showing result panel")
        setShowResult(true)

        // 调用 onComplete
        if (onCompleteRef.current) {
          let durationSeconds = 0

          if (totalPlayedSecondsRef.current > 0) {
            durationSeconds = Math.round(totalPlayedSecondsRef.current)
          } else if (pageStartTime) {
            durationSeconds = Math.max(1, Math.round((Date.now() - pageStartTime) / 1000))
          } else {
            durationSeconds = 1
          }

          console.log('ShadowingPanel - Calling onComplete:', {
            isCorrect,
            durationSeconds,
            totalPlayedSeconds: totalPlayedSecondsRef.current,
            pageStartTime,
            sentenceId: sentence.id,
            sentenceText: sentence.text
          })

          // 如果完全正确，播放成功音效（只播放一次）
          console.log('ShadowingPanel - Checking success sound conditions:', { isCorrect, alreadyPlayed: successSoundPlayedRef.current })
          if (isCorrect && !successSoundPlayedRef.current) {
            console.log('ShadowingPanel - Playing success sound')
            successSoundPlayedRef.current = true
            playSuccessSound()
          } else {
            console.log('ShadowingPanel - Success sound NOT played:', { isCorrect, alreadyPlayed: successSoundPlayedRef.current })
          }

          onCompleteRef.current(isCorrect, durationSeconds)
        }
      }, 500) // 等待 500ms 让音频录制完成
    } else {
      console.warn("No transcript received")
      setMicError("No speech detected, please try again")
    }
  }

  // 播放用户录音
  const playRecording = async () => {
    if (audioRef.current && recordedAudioUrl) {
      try {
        // 设置音量（与全局音量保持一致）
        audioRef.current.volume = getSavedVolume()
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      } catch (err) {
        console.error("Error playing recording:", err)
      }
    }
  }

  // 存储清理函数的 ref
  const cleanupRef = useRef<(() => void) | null>(null)

  // 播放原音
  const playOriginal = () => {
    if (originalAudioRef.current) {
      const audio = originalAudioRef.current

      console.log('playOriginal - Starting playback at', sentence.startTime, 'to', sentence.endTime)

      // 清理之前的定时器和事件监听器
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }

      // 先暂停音频，重置状态
      audio.pause()
      // 给音频一点时间来暂停
      setTimeout(() => {
        // 设置播放位置
        const startTime = typeof sentence.startTime === 'string' ? parseFloat(sentence.startTime) : sentence.startTime
        audio.currentTime = startTime
        setIsPlaying(false)
        lastUpdateTimeRef.current = Date.now()

        // 使用 useRef 存储事件处理器，确保可以正确移除
        const handlePlay = () => {
          if (!isPlaying) {
            setIsPlaying(true)
            lastUpdateTimeRef.current = Date.now()
            console.log('Audio play event fired at', audio.currentTime)
          }
        }

        const handlePause = () => {
          if (isPlaying) {
            const now = Date.now()
            const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000
            totalPlayedSecondsRef.current += elapsedSeconds
            setTotalPlayedSeconds(totalPlayedSecondsRef.current)
            setIsPlaying(false)

            console.log(`Audio paused. Elapsed: ${elapsedSeconds.toFixed(2)}s, Total: ${totalPlayedSecondsRef.current.toFixed(2)}s`)
          }
        }

        const handleTimeUpdate = () => {
          if (isPlaying) {
            const now = Date.now()
            const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000
            lastUpdateTimeRef.current = now

            // 累计播放时间
            totalPlayedSecondsRef.current += elapsedSeconds
            setTotalPlayedSeconds(totalPlayedSecondsRef.current)

            // 检查是否到达结束时间
            const endTime = typeof sentence.endTime === 'string' ? parseFloat(sentence.endTime) : sentence.endTime
            if (audio.currentTime >= endTime) {
              audio.pause()
            }
          }
        }

        // 等待跳转完成后再播放
        let seekAttempts = 0
        const maxSeekAttempts = 10

        const verifyAndPlay = () => {
          seekAttempts++
          const currentTime = audio.currentTime
          const targetTime = typeof sentence.startTime === 'string' ? parseFloat(sentence.startTime) : sentence.startTime
          const diff = Math.abs(currentTime - targetTime)

          console.log(`Seek attempt ${seekAttempts}: current=${currentTime.toFixed(2)}s, target=${targetTime.toFixed(2)}s, diff=${diff.toFixed(2)}s`)

          // 如果接近目标位置（允许0.5秒误差），开始播放
          if (diff < 0.5) {
            console.log('Position verified, starting playback at', currentTime)
            // 设置音量（与全局音量保持一致）
            audio.volume = getSavedVolume()
            audio.play().catch(err => {
              console.error('Failed to play audio:', err)
            })
            audio.removeEventListener('seeked', verifyAndPlay)
            audio.removeEventListener('timeupdate', checkSeek)
          } else if (seekAttempts >= maxSeekAttempts) {
            // 超过最大尝试次数，强制播放
            console.warn('Max seek attempts reached, playing at current position', currentTime)
            // 设置音量（与全局音量保持一致）
            audio.volume = getSavedVolume()
            audio.play().catch(err => {
              console.error('Failed to play audio:', err)
            })
            audio.removeEventListener('seeked', verifyAndPlay)
            audio.removeEventListener('timeupdate', checkSeek)
          } else {
            // 还没到达目标位置，继续等待
            audio.currentTime = targetTime
          }
        }

        const handleSeeked = () => {
          console.log('Seeked event fired, current position:', audio.currentTime)
          // seeked 事件触发后验证位置
          setTimeout(verifyAndPlay, 50)
        }

        const checkSeek = () => {
          const startTime = typeof sentence.startTime === 'string' ? parseFloat(sentence.startTime) : sentence.startTime
          if (audio.currentTime >= startTime - 0.5) {
            verifyAndPlay()
          }
        }

        const handleEnded = () => {
          if (isPlaying) {
            const now = Date.now()
            const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000
            totalPlayedSecondsRef.current += elapsedSeconds
            setTotalPlayedSeconds(totalPlayedSecondsRef.current)
            setIsPlaying(false)

            console.log(`Audio ended. Elapsed: ${elapsedSeconds.toFixed(2)}s, Total: ${totalPlayedSecondsRef.current.toFixed(2)}s`)
          }
        }

        // 添加事件监听器
        audio.addEventListener('play', handlePlay, { once: false })
        audio.addEventListener('pause', handlePause, { once: false })
        audio.addEventListener('timeupdate', handleTimeUpdate, { once: false })
        audio.addEventListener('ended', handleEnded, { once: false })
        audio.addEventListener('seeked', handleSeeked, { once: true })
        audio.addEventListener('timeupdate', checkSeek, { once: false })

        // 保存清理函数
        cleanupRef.current = () => {
          audio.removeEventListener('play', handlePlay)
          audio.removeEventListener('pause', handlePause)
          audio.removeEventListener('timeupdate', handleTimeUpdate)
          audio.removeEventListener('ended', handleEnded)
          audio.removeEventListener('seeked', verifyAndPlay)
          audio.removeEventListener('timeupdate', checkSeek)
        }

        // 初始触发跳转
        const startTimeValue = typeof sentence.startTime === 'string' ? parseFloat(sentence.startTime) : sentence.startTime
        console.log('Setting currentTime to', startTimeValue)
        audio.currentTime = startTimeValue
        setTimeout(verifyAndPlay, 100)  // 100ms 后验证并播放

        // 在句子的结束时间停止播放
        const endTimeValue = typeof sentence.endTime === 'string' ? parseFloat(sentence.endTime) : sentence.endTime
        const durationToPlay = (endTimeValue - startTimeValue) * 1000
        setTimeout(() => {
          audio.pause()
          // 清理事件监听器
          if (cleanupRef.current) {
            cleanupRef.current()
            cleanupRef.current = null
          }
        }, durationToPlay + 200) // 增加一些缓冲时间
      }, 50) // 给音频一点时间来暂停
    }
  }

  /**
   * 检测并生成连读提示
   * 【已禁用】影子跟读练习中不再显示连读提示
   * 用户要求：Ban "Linking Tips" in shadowing practice
   */
  const getLinkingTips = (): { hasTips: boolean; pairs: LinkingPair[] } => {
    // 始终返回 false，禁用连读提示
    return { hasTips: false, pairs: [] }
  }

  /**
   * 渲染单词级对比结果（友好反馈版 + 视觉精准反馈）
   * - 不再使用红色表示"错误"
   * - 使用淡橙色/灰色暗示"可以更精准"
   * - 即使整句通过，也高亮显示读错的单词（橙色 + 下划线）
   */
  const renderWordDiffs = () => {
    return wordDiffs.map((diff, index) => {
      const key = `${diff.word}-${index}-${diff.status}`

      if (diff.status === 'match') {
        // 正确匹配：深灰色
        return (
          <span key={key} className="text-gray-800">
            {diff.word}{' '}
          </span>
        )
      } else if (diff.status === 'insertion') {
        // 多读/读错：橙色 + 下划线（表示读错，需要改进）
        return (
          <span key={key} className="text-orange-500 font-semibold underline decoration-2 underline-offset-2">
            {diff.word}{' '}
          </span>
        )
      } else if (diff.status === 'deletion') {
        // 漏读：淡橙色 + 下划线（提示可以更完整）
        return (
          <span
            key={key}
            className="inline-block bg-orange-50 text-orange-400 border border-orange-200 px-1 rounded mr-1 underline decoration-2 underline-offset-2"
            title={`漏读: ${diff.word}`}
          >
            {diff.word}
          </span>
        )
      } else if (diff.status === 'weak_link') {
        // 连读弱读：灰色括号提示（中性）
        return (
          <span
            key={key}
            className="inline-block bg-gray-100 text-gray-400 border border-gray-200 px-1 rounded mr-1 text-sm"
            title={`连读弱读: ${diff.word}`}
          >
            {diff.word}
          </span>
        )
      } else if (diff.status === 'partial_match') {
        // 整句通过但该词读错：橙色 + 下划线（视觉精准反馈）
        return (
          <span key={key} className="text-orange-500 underline decoration-2 underline-offset-2" title={`发音可以更精准: ${diff.word}`}>
            {diff.word}{' '}
          </span>
        )
      }
      return null
    })
  }

  // 判断读音正确性（使用句子级别的模糊匹配）
  // 阈值：70% 及以上 = 正确（绿色），50% 以下 = 需要改进（红色）
  const SIMILARITY_THRESHOLD = 0.70
  const LOW_THRESHOLD = 0.50

  // 计算最佳匹配度
  const bestMatch = Math.max(sentenceSimilarity, wordMatchRate)
  const isCorrect = showResult && bestMatch >= SIMILARITY_THRESHOLD
  const isPoor = showResult && bestMatch < LOW_THRESHOLD

  return (
    <div>
      {/* 原音播放器（已禁用 - 使用主页面的 AudioPlayer 避免冲突） */}
      {/* <audio ref={originalAudioRef} src={audioSrc} /> */}

      {/* 显示模式切换按钮 */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setDisplayMode('full')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            displayMode === 'full'
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Show All
        </button>
        <button
          onClick={() => setDisplayMode('translation-only')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            displayMode === 'translation-only'
              ? 'bg-orange-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Translation Only
        </button>
        <button
          onClick={() => setDisplayMode('blind')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            displayMode === 'blind'
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Hide All
        </button>
      </div>

      {/* 参考文本 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        {/* 原句 - 根据模式显示或隐藏 */}
        {displayMode !== 'translation-only' && displayMode !== 'blind' && (
          <>
            <div className="flex items-center justify-end mb-2">
              {/* Translation Language Selector - 居右 */}
              {sentence.translation && (
                <TranslationLanguageSelector onLanguageChange={handleLanguageChange} />
              )}
            </div>
            <p className="text-base text-gray-800 leading-relaxed">
              {sentence.text}
            </p>
          </>
        )}

        {/* 多语言翻译 - 根据模式显示或隐藏，支持简/繁/越切换 */}
        {displayMode !== 'blind' && sentence.translation && showTranslation && currentTranslation && (
          <>
            <p className={`text-base ${displayMode === 'translation-only' ? 'text-gray-900 font-medium' : 'text-gray-600 italic'} leading-relaxed mt-4`}>
              {currentTranslation}
            </p>
          </>
        )}

        {/* 盲模式提示 */}
        {displayMode === 'blind' && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span className="text-lg">🙈</span>
              <span>Blind mode - Listen and speak without reading</span>
            </p>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {micError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{micError}</p>
        </div>
      )}

      {/* 用户读音结果 - 单词级对比 */}
      {(() => {
        console.log("Rendering result section: showResult =", showResult, "wordDiffs.length =", wordDiffs.length, "isCorrect =", isCorrect)
        return null
      })()}
      {showResult && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          isCorrect
            ? "bg-green-50 border-green-300"
            : "bg-orange-50 border-orange-300"
        }`}>
          <p className="text-xs text-gray-500 mb-2">My Pronunciation:</p>

          {/* 音频播放器 - 紧凑版，放在 My Pronunciation 下方 */}
          {recordedAudioUrl && (
            <div className="mb-3">
              <audio
                ref={audioRef}
                src={recordedAudioUrl}
                controls
                className="w-full h-10"
                onError={(e) => console.error("Audio error:", e)}
              />
            </div>
          )}

          {/* 单词对比结果 - 优化版：即使整句通过，也显示读错的单词 */}
          <div className="mb-3 text-base leading-relaxed">
            {wordDiffs.length > 0 ? (
              (() => {
                // 检查是否有读错的单词（insertion 或 deletion）
                const hasErrors = wordDiffs.some(d => d.status === 'insertion' || d.status === 'deletion')

                // 如果相似度 >= 70% 且没有读错的单词，只显示绿色原文
                if (bestMatch >= 0.7 && !hasErrors) {
                  return (
                    <div className="text-green-700 font-medium">
                      {sentenceRef.current.text}
                    </div>
                  )
                }

                // 否则显示详细的单词对比（高亮读错的单词）
                return renderWordDiffs()
              })()
            ) : (
              <div className="text-gray-600">
                {userTranscript || "No speech detected"}
              </div>
            )}
          </div>

          {/* 连读小贴士 */}
          {(() => {
            const { hasTips, pairs } = getLinkingTips()
            if (!hasTips) return null

            return (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <span>
                    <strong>Linking Tips:</strong>
                    <span className="block mt-1">
                      {pairs.map((pair, index) => (
                        <span key={index}>
                          <strong>{pair.first} {pair.second}</strong> can be linked{pair.ipa && `, pronounced as ${pair.ipa}`}
                        </span>
                      ))}
                    </span>
                  </span>
                </p>
              </div>
            )
          })()}

          {/* 整体正确性判断 - 文案分级矩阵（修正版） */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            {(() => {
              // 计算单词匹配情况
              const totalWords = wordDiffs.length
              const matchedWords = wordDiffs.filter(d => d.status === 'match' || d.status === 'weak_link').length
              const wordMatchRate = totalWords > 0 ? matchedWords / totalWords : 0

              // 计算单词错误数量
              const errorCount = wordDiffs.filter(d => d.status === 'deletion').length

              console.log("文案分级计算:", {
                totalWords,
                matchedWords,
                errorCount,
                wordMatchRate: `${(wordMatchRate * 100).toFixed(1)}%`,
                sentenceSimilarity: `${(sentenceSimilarity * 100).toFixed(1)}%`,
                bestMatch: `${(bestMatch * 100).toFixed(1)}%`
              })

              // 第一级：Perfect (全对)
              if (wordMatchRate === 1.0) {
                return (
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-2xl">🌟</span>
                    <span className="font-medium">Excellent! Perfect pronunciation</span>
                  </div>
                )
              }

              // 第二级：Good (有少量瑕疵) - 单词匹配率 >= 80%
              if (wordMatchRate >= 0.8) {
                return (
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-2xl">👍</span>
                    <span className="font-medium">Great job! Some words can be more precise</span>
                  </div>
                )
              }

              // 第三级：Medium (中等) - 单词匹配率 >= 50%
              if (wordMatchRate >= 0.5) {
                return (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <span className="text-2xl">✨</span>
                    <span className="font-medium">Most words are correct, keep it up!</span>
                  </div>
                )
              }

              // 第四级：Keep Trying (勉强通过) - 句子相似度 >= 70% 但单词匹配率 < 50%
              if (bestMatch >= 0.7) {
                return (
                  <div className="flex items-center gap-2 text-orange-500">
                    <span className="text-2xl">💪</span>
                    <span className="font-medium">Good job! Practice more on orange words</span>
                  </div>
                )
              }

              // 第五级：Fail (未通过) - 句子相似度 < 50%
              if (isPoor) {
                return (
                  <div className="flex items-center gap-2 text-red-500">
                    <span className="text-2xl">😅</span>
                    <span className="font-medium">It's okay, try again, you can do it!</span>
                  </div>
                )
              }

              // 默认状态
              return (
                <div className="flex items-center gap-2 text-orange-500">
                  <span className="text-2xl">✨</span>
                  <span className="font-medium">Keep practicing! Practice makes perfect</span>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* 麦克风按钮 - 圆角四方形 + 文字 */}
      <div className="flex justify-center mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!recognition || !mediaRecorder}
          className={`flex items-center gap-3 px-6 py-3 rounded-lg transition-all ${
            isRecording
              ? "bg-red-500 text-white shadow-lg"
              : "bg-blue-500 text-white hover:bg-blue-600 shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
          }`}
        >
          {/* 麦克风图标 */}
          <svg className={`w-6 h-6 ${isRecording ? "animate-pulse" : ""}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          {/* 文字 */}
          <span className="text-sm font-medium whitespace-nowrap">
            {isRecording ? "Stop Recording" : "Start Recording"}
          </span>
        </button>
      </div>

      {/* Next 按钮 */}
      {recordedAudioUrl && (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => {
              if (onNext && !isLastSentence) {
                onNext()
              }
            }}
            disabled={isLastSentence}
            className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            Next
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* 录音状态提示 */}
      {isRecording && (
        <div className="text-center mb-4">
          <p className="text-sm text-red-500 animate-pulse">Recording...</p>
        </div>
      )}
    </div>
  )
}
