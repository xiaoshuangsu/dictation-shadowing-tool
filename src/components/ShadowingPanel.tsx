"use client"

import { useState, useEffect, useRef } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useSuccessSound } from "@/hooks/useSuccessSound"
import { intelligentMatch } from "@/lib/audio-checker"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string  // 可选的中文翻译字段
}

interface ShadowingPanelProps {
  sentence: Sentence
  audioSrc: string  // 新增：音频源
  currentTime?: number  // 当前播放时间（用于确定显示哪个子句）
  onComplete?: (isCorrect: boolean, durationSeconds: number) => void
  onNext?: () => void
  isLastSentence?: boolean
}

// 单词对比结果类型
interface WordDiff {
  word: string           // 单词原文
  status: 'match' | 'insertion' | 'deletion' | 'weak_link'  // 匹配 | 多读 | 漏读 | 连读弱读
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

export default function ShadowingPanel({ sentence, audioSrc, currentTime, onComplete, onNext, isLastSentence }: ShadowingPanelProps) {
  const { t } = useLanguage()
  const { playSuccessSound } = useSuccessSound() // 使用全局静音状态
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [userTranscript, setUserTranscript] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [wordDiffs, setWordDiffs] = useState<WordDiff[]>([])  // 单词对比结果

  // 显示控制模式
  type DisplayMode = 'full' | 'translation-only' | 'blind'
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full')  // full: 显示原句+释义, translation-only: 只显示释义, blind: 完全隐藏

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
   * 单词级对比算法
   * 使用简化的 diff 算法：双指针遍历
   */
  const compareWords = (originalText: string, recognizedText: string): WordDiff[] => {
    console.log("compareWords called:", { originalText, recognizedText })

    // 预处理：转小写，去除标点，拆分为单词数组
    const normalize = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')  // 去除所有非字母数字字符
        .replace(/\s+/g, ' ')
        .trim()
    }

    const originalWords = normalize(originalText).split(' ').filter(w => w.length > 0)
    const recognizedWords = normalize(recognizedText).split(' ').filter(w => w.length > 0)

    console.log("Normalized words:", { originalWords, recognizedWords })

    const diffs: WordDiff[] = []
    let i = 0  // 原句指针
    let j = 0  // 识别文本指针

    while (i < originalWords.length || j < recognizedWords.length) {
      if (i >= originalWords.length) {
        // 原句已结束，剩余的都是多读的词
        diffs.push({
          word: recognizedWords[j],
          status: 'insertion'
        })
        j++
      } else if (j >= recognizedWords.length) {
        // 识别文本已结束，剩余的都是漏读的词
        diffs.push({
          word: originalWords[i],
          status: 'deletion',
          originalIndex: i
        })
        i++
      } else {
        // 使用智能匹配算法（Metaphone + 上下文感知）- "口语优先"容错版本
        // 降低置信度阈值：0.75 → 0.60，接受更多合理发音变体
        const context = originalWords.slice(Math.max(0, i - 1), i + 2)
        const matchResult = intelligentMatch(originalWords[i], recognizedWords[j], context)

        if (matchResult.isMatch && matchResult.confidence >= 0.60) {
          // 匹配成功（包括近音词、STT误判修正、常见发音变体）
          if (matchResult.confidence >= 0.85) {
            // 高置信度：完全匹配（绿色）
            diffs.push({
              word: originalWords[i],
              status: 'match',
              originalIndex: i
            })
          } else {
            // 中等置信度：接近匹配（灰色/weak_link）- 容忍发音差异
            diffs.push({
              word: originalWords[i],
              status: 'weak_link',
              originalIndex: i
            })
          }
          i++
          j++
        } else {
          // 不匹配 - 尝试对齐
          // 策略：双向查找，找到最佳匹配点
          let foundMatch = false
          let lookAhead = 1
          const maxLookAhead = 3

          // 先在原句中向前查找（用户可能漏读了原句的词）
          while (lookAhead <= maxLookAhead && i + lookAhead < originalWords.length) {
            if (originalWords[i + lookAhead] === recognizedWords[j] ||
                areSimilarSounding(originalWords[i + lookAhead], recognizedWords[j])) {
              // 找到匹配：原句漏了 i 到 i+lookAhead-1 的词
              for (let k = 0; k < lookAhead; k++) {
                const missedWord = originalWords[i + k]
                const isWeakWord = LINKING_WORDS.has(missedWord.toLowerCase())

                // 检查是否是连读弱读情况
                let isWeakLink = false
                if (isWeakWord && k === 0) {
                  // 检查前一个词（如果存在）
                  const prevWord = i > 0 ? originalWords[i - 1] : null
                  // 检查下一个词
                  const nextWord = i + lookAhead < originalWords.length ? originalWords[i + lookAhead] : null

                  // 如果是辅音结尾 + 弱读词 + 元音开头，可能是连读弱读
                  if (prevWord && nextWord && isConsonantEnd(prevWord) && isVowelStart(nextWord)) {
                    isWeakLink = true
                  }
                }

                diffs.push({
                  word: missedWord,
                  status: isWeakLink ? 'weak_link' : 'deletion',
                  originalIndex: i + k
                })
              }
              // 匹配当前词
              diffs.push({
                word: recognizedWords[j],
                status: 'match',
                originalIndex: i + lookAhead
              })
              i += lookAhead + 1
              j++
              foundMatch = true
              break
            }
            lookAhead++
          }

          // 如果原句中没找到，尝试在识别文本中向前查找（用户可能多读了词）
          if (!foundMatch) {
            lookAhead = 1
            while (lookAhead <= maxLookAhead && j + lookAhead < recognizedWords.length) {
              if (originalWords[i] === recognizedWords[j + lookAhead] ||
                  areSimilarSounding(originalWords[i], recognizedWords[j + lookAhead])) {
              // 找到匹配：识别文本多了 j 到 j+lookAhead-1 的词
              for (let k = 0; k < lookAhead; k++) {
                diffs.push({
                  word: recognizedWords[j + k],
                  status: 'insertion'
                })
              }
              // 匹配当前词
              diffs.push({
                word: originalWords[i],
                status: 'match',
                originalIndex: i
              })
              j += lookAhead + 1
              i++
              foundMatch = true
              break
            }
            lookAhead++
          }
        }

        // 如果都没找到，标记为替换（读错）
        if (!foundMatch) {
          const recognizedWord = recognizedWords[j]
          const originalWord = originalWords[i]

          // 检查是否是弱读词的连读替换（如 a → the）
          const isWeakWord = LINKING_WORDS.has(originalWord.toLowerCase())
          const isRecognizedWeakWord = LINKING_WORDS.has(recognizedWord.toLowerCase())
          const isPrevConsonantEnd = i > 0 && isConsonantEnd(originalWords[i - 1])
          const isNextVowelStart = i + 1 < originalWords.length && isVowelStart(originalWords[i + 1])

          // 如果原词是弱读词，且前后构成连读环境
          if (isWeakWord && isPrevConsonantEnd && isNextVowelStart) {
            // 如果识别出的词也是弱读词，视为正确匹配
            if (isRecognizedWeakWord) {
              diffs.push({
                word: originalWord,
                status: 'match',
                originalIndex: i
              })
            } else {
              // 识别出的不是弱读词，标记为 weak_link
              diffs.push({
                word: recognizedWord,
                status: 'insertion'
              })
              diffs.push({
                word: originalWord,
                status: 'weak_link',
                originalIndex: i
              })
            }
          } else {
            // 普通读错
            diffs.push({
              word: recognizedWord,
              status: 'insertion'
            })
            diffs.push({
              word: originalWord,
              status: 'deletion',
              originalIndex: i
            })
          }
          i++
          j++
        }
      }
      }
    }

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

                if (result.isFinal) {
                  console.log("Final transcript:", interimTranscript)
                  console.log("Expected text:", sentenceRef.current.text)
                  setUserTranscript(interimTranscript)
                  console.log("Setting showResult to true...")
                  setShowResult(true)
                  resultProcessedRef.current = true  // Mark result as processed
                  console.log("showResult state set (async, will take effect on next render)")

                  // 执行单词级对比
                  const diffs = compareWords(sentenceRef.current.text, interimTranscript)
                  console.log("Word diffs result:", diffs)
                  console.log("Word diffs length:", diffs.length)
                  console.log("Diffs JSON:", JSON.stringify(diffs, null, 2))
                  setWordDiffs(diffs)
                  console.log("setWordDiffs called")

                  // 计算整体正确性
                  const hasErrors = diffs.some(d => d.status !== 'match')
                  const isCorrect = !hasErrors

                  console.log("Word comparison:", diffs)
                  console.log("Pronunciation correct:", isCorrect, "Expected:", sentenceRef.current.text)

                  // 延迟调用 onComplete，确保状态更新后再触发 transcript 更新
                  setTimeout(() => {
                    if (onCompleteRef.current) {
                      // 时间计算优先级：真实播放时间 > 页面停留时间
                      let durationSeconds = 0

                      // 1. 尝试使用真实音频播放时间
                      if (totalPlayedSecondsRef.current > 0) {
                        durationSeconds = Math.round(totalPlayedSecondsRef.current)
                        console.log(`Using real audio playback time: ${durationSeconds}s`)
                      }
                      // 2. 兜底：使用页面停留时间
                      else if (pageStartTime) {
                        durationSeconds = Math.max(1, Math.round((Date.now() - pageStartTime) / 1000))
                        console.log(`Using page stay time as fallback: ${durationSeconds}s`)
                      }
                      // 3. 最后兜底：默认 1 秒
                      else {
                        durationSeconds = 1
                        console.log('Using default time: 1s')
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

                      // 传递秒数
                      onCompleteRef.current(isCorrect, durationSeconds)
                    }
                  }, 100)
                }
              }
            }

            recog.onerror = (event: any) => {
              console.error("Speech recognition error:", event.error)
              setMicError(`语音识别错误: ${event.error}`)
              setIsRecording(false)
            }

            recog.onend = () => {
              console.log("Speech recognition ended. resultProcessedRef =", resultProcessedRef.current)
              // 移动端：不自动停止录音，让用户手动点击麦克风按钮停止
              // 只有在用户手动点击停止时才会设置 setIsRecording(false)

              // Only process if we haven't already processed a final result
              if (!resultProcessedRef.current) {
                const interimTranscript = userTranscriptRef.current
                if (interimTranscript) {
                  console.log("Processing interim result:", interimTranscript)
                  console.log("Expected text:", sentenceRef.current.text)

                  setUserTranscript(interimTranscript)
                  console.log("Setting showResult to true (from onend)...")
                  setShowResult(true)

                  // 执行单词级对比
                  const diffs = compareWords(sentenceRef.current.text, interimTranscript)
                  console.log("Word diffs result:", diffs)
                  setWordDiffs(diffs)

                  // 计算整体正确性
                  const hasErrors = diffs.some(d => d.status !== 'match')
                  const isCorrect = !hasErrors

                  console.log("Pronunciation correct:", isCorrect)

                  // 延迟调用 onComplete
                  setTimeout(() => {
                    if (onCompleteRef.current) {
                      let durationSeconds = 0

                      if (totalPlayedSecondsRef.current > 0) {
                        durationSeconds = Math.round(totalPlayedSecondsRef.current)
                      } else if (pageStartTime) {
                        durationSeconds = Math.max(1, Math.round((Date.now() - pageStartTime) / 1000))
                      } else {
                        durationSeconds = 1
                      }

                      console.log('ShadowingPanel - Calling onComplete (from onend):', {
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
                  }, 100)
                } else {
                  console.warn("No transcript received from speech recognition")
                  setMicError("未能识别到语音，请重试")
                }
              } else {
                console.log("Result already processed, skipping onend processing")
              }
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
        audio.currentTime = sentence.startTime
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
            if (audio.currentTime >= sentence.endTime) {
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
          const targetTime = sentence.startTime
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
          if (audio.currentTime >= sentence.startTime - 0.5) {
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
        console.log('Setting currentTime to', sentence.startTime)
        audio.currentTime = sentence.startTime
        setTimeout(verifyAndPlay, 100)  // 100ms 后验证并播放

        // 在句子的结束时间停止播放
        const durationToPlay = (sentence.endTime - sentence.startTime) * 1000
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
   * 渲染单词级对比结果
   */
  const renderWordDiffs = () => {
    return wordDiffs.map((diff, index) => {
      const key = `${diff.word}-${index}-${diff.status}`

      if (diff.status === 'match') {
        // 正常匹配：灰色
        return (
          <span key={key} className="text-gray-800">
            {diff.word}{' '}
          </span>
        )
      } else if (diff.status === 'insertion') {
        // 多读/读错：红色加粗下划线
        return (
          <span key={key} className="text-red-500 font-bold underline">
            {diff.word}{' '}
          </span>
        )
      } else if (diff.status === 'deletion') {
        // 漏读：浅红色方框
        return (
          <span
            key={key}
            className="inline-block bg-red-50 text-red-400 border border-dashed border-red-300 px-1 rounded mr-1"
            title={`漏读: ${diff.word}`}
          >
            [{diff.word}]
          </span>
        )
      } else if (diff.status === 'weak_link') {
        // 连读弱读：灰色括号提示
        return (
          <span
            key={key}
            className="inline-block bg-gray-100 text-gray-400 border border-gray-200 px-1 rounded mr-1 text-sm"
            title={`连读弱读: ${diff.word}`}
          >
            ({diff.word})
          </span>
        )
      }
      return null
    })
  }

  // 判断读音正确性（基于单词级对比）
  // weak_link 不算错误，因为它表示连读弱读，是正常的发音现象
  const isCorrect = wordDiffs.length > 0 ? wordDiffs.every(d => d.status === 'match' || d.status === 'weak_link') : false

  return (
    <div>
      {/* 原音播放器（已禁用 - 使用主页面的 AudioPlayer 避免冲突） */}
      {/* <audio ref={originalAudioRef} src={audioSrc} /> */}

      <p className="text-sm text-gray-500 mb-4">
        💡 {t('practice.shadowing.tip')}
      </p>

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
          {t('practice.shadowing.showAll')}
        </button>
        <button
          onClick={() => setDisplayMode('translation-only')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            displayMode === 'translation-only'
              ? 'bg-orange-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('practice.shadowing.translationOnly')}
        </button>
        <button
          onClick={() => setDisplayMode('blind')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            displayMode === 'blind'
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('practice.shadowing.hideAll')}
        </button>
      </div>

      {/* 参考文本 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        {/* 原句 - 根据模式显示或隐藏 */}
        {displayMode !== 'translation-only' && displayMode !== 'blind' && (
          <>
            <p className="text-sm text-gray-500 mb-2">{t('practice.shadowing.original')}:</p>
            <p className="text-base text-gray-800 leading-relaxed">
              {sentence.text}
            </p>
          </>
        )}

        {/* 中文翻译 - 根据模式显示或隐藏 */}
        {displayMode !== 'blind' && sentence.translation && (
          <>
            <p className="text-sm text-gray-500 mb-2 mt-4">
              {t('practice.shadowing.translation')}:
            </p>
            <p className={`text-base ${displayMode === 'translation-only' ? 'text-gray-900 font-medium' : 'text-gray-600 italic'} leading-relaxed`}>
              {sentence.translation}
            </p>
          </>
        )}

        {/* 盲模式提示 */}
        {displayMode === 'blind' && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span className="text-lg">🙈</span>
              <span>{t('practice.shadowing.blindMode')}</span>
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
          <p className="text-xs text-gray-500 mb-2">{t('practice.shadowing.myPronunciation')}:</p>

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

          {/* 单词对比结果 */}
          <div className="mb-3 text-base leading-relaxed">
            {wordDiffs.length > 0 ? (
              renderWordDiffs()
            ) : (
              <div className="text-gray-600">
                {userTranscript || t('practice.shadowing.noRecognition')}
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
                    <strong>{t('practice.shadowing.linkingTips')}:</strong>
                    <span className="block mt-1">
                      {pairs.map((pair, index) => (
                        <span key={index}>
                          <strong>{pair.first} {pair.second}</strong> {t('practice.shadowing.canBeLinked')}{pair.ipa && `, ${t('practice.shadowing.pronouncedAs')} ${pair.ipa}`}
                        </span>
                      ))}
                    </span>
                  </span>
                </p>
              </div>
            )
          })()}

          {/* 整体正确性判断 */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            {isCorrect ? (
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{t('practice.shadowing.perfectPronunciation')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">继续加油！多练习能让发音更自然</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 大麦克风按钮 */}
      <div className="flex justify-center mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!recognition || !mediaRecorder}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? "bg-red-500 text-white scale-100 shadow-lg"
              : "bg-blue-500 text-white hover:bg-blue-600 hover:scale-100 shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100"
          }`}
        >
          <svg className={`w-8 h-8 ${isRecording ? "animate-pulse" : ""}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
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
            {t('practice.next')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* 录音状态提示 */}
      {isRecording && (
        <div className="text-center mb-4">
          <p className="text-sm text-red-500 animate-pulse">{t('practice.shadowing.recording')}</p>
        </div>
      )}
    </div>
  )
}
