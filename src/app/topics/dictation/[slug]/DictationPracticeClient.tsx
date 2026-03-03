'use client'

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import AudioPlayer from "@/components/AudioPlayer"
import VideoPlayer from "@/components/VideoPlayer"
import DictationBox from "@/components/DictationBox"
import ShadowingPanel from "@/components/ShadowingPanel"
import WordMode from "@/components/WordMode"
import { useAuth } from "@/lib/hooks/useAuth"
import { savePracticeRecord } from "@/lib/supabase/client"
import { onDictationComplete, onShadowingComplete } from "@/lib/supabase/streak"
import { useLanguage } from "@/contexts/LanguageContext"
import LocalizedLink from "@/components/LocalizedLink"
import { titleToSlug } from "@/lib/utils/slug"

const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

// Category mapping for bilingual labels
const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  '日常生活': { en: 'Daily Life', zh: '日常生活' },
  '历史演讲': { en: 'Historical Speeches', zh: '历史演讲' },
  '文化历史': { en: 'Culture & History', zh: '文化历史' },
  '艺术文化': { en: 'Arts & Culture', zh: '艺术文化' },
}

const getCategoryLabel = (category: string, language: 'en' | 'zh') => {
  return CATEGORY_LABELS[category]?.[language] || category
}

const DEFAULT_AUDIO_TITLE = "First Snowfall"
const DEFAULT_AUDIO_SRC = "/learn-english-via-listening-1001.mp3"

const defaultSentences = [
  { id: 1, text: "First snowfall.", startTime: 0.0, endTime: 1.6, translation: "第一场雪。" },
  { id: 2, text: "Today is November 26th.", startTime: 3.6, endTime: 5.6, translation: "今天是11月26日。" },
  { id: 3, text: "It snowed all day today.", startTime: 6.3, endTime: 7.8, translation: "今天下了一整天的雪。" },
  { id: 4, text: "The snow is beautiful.", startTime: 8.8, endTime: 10.4, translation: "雪很美。" },
  { id: 5, text: "The snow finally stopped.", startTime: 11.5, endTime: 13.2, translation: "雪终于停了。" },
  { id: 6, text: "My sister and I are excited.", startTime: 14.9, endTime: 16.6, translation: "我和姐姐很兴奋。" },
  { id: 7, text: "My mom doesn't like the snow.", startTime: 17.6, endTime: 19.5, translation: "我妈妈不喜欢雪。" },
  { id: 8, text: "My mom has to shovel the driveway.", startTime: 20.5, endTime: 22.6, translation: "我妈妈得铲车道上的雪。" },
  { id: 9, text: "My sister and I get to play.", startTime: 23.7, endTime: 25.6, translation: "我和姐姐可以玩耍了。" },
  { id: 10, text: "I put on my hat and mittens.", startTime: 26.7, endTime: 28.9, translation: "我戴上帽子和手套。" },
  { id: 11, text: "My mom puts on my scarf.", startTime: 29.7, endTime: 31.3, translation: "妈妈给我围上围巾。" },
  { id: 12, text: "My mom zippers my jacket.", startTime: 32.4, endTime: 34.2, translation: "妈妈拉上我夹克的拉链。" },
  { id: 13, text: "My sister puts on her hat and mittens.", startTime: 35.1, endTime: 37.7, translation: "姐姐戴上她的帽子和手套。" },
  { id: 14, text: "My mom puts on her scarf.", startTime: 38.6, endTime: 40.5, translation: "妈妈给她围上围巾。" },
  { id: 15, text: "My mom zippers her jacket.", startTime: 41.7, endTime: 43.5, translation: "妈妈拉上她夹克的拉链。" },
  { id: 16, text: "My sister and I go outside.", startTime: 44.7, endTime: 46.6, translation: "我和姐姐走到外面。" },
  { id: 17, text: "We begin to make a snowman.", startTime: 47.3, endTime: 49.5, translation: "我们开始堆雪人。" },
  { id: 18, text: "My mom starts to shovel the snow.", startTime: 50.4, endTime: 52.6, translation: "妈妈开始铲雪。" },
  { id: 19, text: "My sister and I make snow angels.", startTime: 53.7, endTime: 55.7, translation: "我和姐姐做雪天使。" },
  { id: 20, text: "My sister and I throw snowballs.", startTime: 56.7, endTime: 58.7, translation: "我和姐姐扔雪球。" },
  { id: 21, text: "It starts to snow again.", startTime: 59.4, endTime: 61.4, translation: "又开始下雪了。" },
  { id: 22, text: "We go inside for hot chocolate.", startTime: 62.2, endTime: 64.5, translation: "我们进屋喝热巧克力。" },
]

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string
}

type PracticeMode = "dictation" | "shadowing"
type DictationMode = "word" | "whole"

export function DictationPracticeClientContent({ slug }: { slug: string }) {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()

  // 从 URL 参数读取起始句子索引
  const startIndexParam = searchParams.get('start')
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : 0

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [audioTitle, setAudioTitle] = useState<string | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null)
  const [sampleSentences, setSampleSentences] = useState<Sentence[] | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [materialError, setMaterialError] = useState<string | null>(null)
  const [materialCategory, setMaterialCategory] = useState<string | null>(null)

  const [mode, setMode] = useState<PracticeMode>("dictation")
  const [dictationMode, setDictationMode] = useState<DictationMode>("word")
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(startIndex)
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [correctCount, setCorrectCount] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)  // 默认隐藏文稿
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)
  const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false)

  const audioPlaybackSecondsRef = useRef(0)

  // 为每个模式独立保存句子索引
  const dictationSentenceIndexRef = useRef(startIndex)
  const shadowingSentenceIndexRef = useRef(startIndex)

  // 自动保存当前模式的索引到对应的 ref
  useEffect(() => {
    if (mode === 'dictation') {
      dictationSentenceIndexRef.current = currentSentenceIndex
    } else {
      shadowingSentenceIndexRef.current = currentSentenceIndex
    }
  }, [currentSentenceIndex, mode])

  useEffect(() => {
    async function findMaterial() {
      try {
        const { data: allMaterials } = await supabase
          .from('materials')
          .select('*')

        // 改进查找逻辑：支持多种匹配方式，优先选择有完整 transcript 的记录
        let materials = allMaterials?.filter(m => {
          // 1. 精确 ID 匹配
          if (m.id === slug) return true
          // 2. 标题 slug 匹配
          if (titleToSlug(m.title) === slug) return true
          // 3. 模糊匹配：从 slug 中提取关键词进行匹配
          const slugKeywords = slug.replace(/-/g, ' ').toLowerCase()
          const titleLower = m.title.toLowerCase()
          // 移除常见后缀后再匹配
          const titleClean = titleLower
            .replace(/ easy dialogue/g, '')
            .replace(/ english educational animation for kids/g, '')
            .replace(/ for kids/g, '')
            .replace(/english video/g, '')
            .replace(/-/g, ' ')
          if (slugKeywords.includes('this') && slugKeywords.includes('that') &&
              titleClean.includes('this') && titleClean.includes('that')) {
            return true
          }
          return false
        })

        // 优先选择有更多 transcript 的记录（跳过只有默认句子的）
        const material = materials?.sort((a, b) => {
          const aTranscript = a.transcript || []
          const bTranscript = b.transcript || []
          const aCount = aTranscript.length || 0
          const bCount = bTranscript.length || 0
          // 过滤掉只有默认句子的记录
          const aFailed = aCount === 1 && aTranscript[0]?.text?.includes('Please')
          const bFailed = bCount === 1 && bTranscript[0]?.text?.includes('Please')
          if (aFailed && !bFailed) return 1
          if (!aFailed && bFailed) return -1
          return bCount - aCount
        })[0]

        if (material) {
          setMaterialId(material.id)
          setAudioTitle(material.title)
          setMaterialCategory(material.category)

          // R2 Worker 基础 URL
          const R2_WORKER_URL = 'https://r2-proxy.suxiaoshuang2020.workers.dev'

          // 构造完整的 URL
          const getFullUrl = (path: string | null) => {
            if (!path) return null
            if (path.startsWith('http://') || path.startsWith('https://')) {
              return path
            }
            return `${R2_WORKER_URL}/${path}`
          }

          // 设置音频/视频 URL
          const fullAudioPath = getFullUrl(material.audio_path)
          setAudioSrc(fullAudioPath)

          // 检查是否是视频文件
          const hasVideo = material.audio_path && (
            material.audio_path.endsWith('.mp4') ||
            material.audio_path.endsWith('-mp4') ||
            material.audio_path.includes('.mp4')
          )

          if (hasVideo && fullAudioPath) {
            setVideoUrl(fullAudioPath)
          }

          // 设置缩略图
          if (material.thumbnail_path) {
            const thumbnailUrl = getFullUrl(material.thumbnail_path)
            setThumbnailPath(thumbnailUrl)
          }

          // Use transcript from material (like the original practice page)
          if (material.transcript && Array.isArray(material.transcript) && material.transcript.length > 0) {
            // Convert startTime and endTime from strings to numbers
            const transcript = material.transcript.map((s: any, index: number) => ({
              ...s,
              // 只在没有id时才添加
              id: s.id ?? index,
              startTime: parseFloat(s.startTime),
              endTime: parseFloat(s.endTime),
            }))
            setSampleSentences(transcript)
          } else {
            setSampleSentences(defaultSentences)
          }
        } else {
          setMaterialError('Material not found')
          // 不设置默认值，避免闪烁
        }
      } catch (error) {
        console.error('Error loading material:', error)
        setMaterialError('Failed to load material')
        // 不设置默认值，避免闪烁
      } finally {
        setIsInitialLoading(false)
      }
    }

    findMaterial()
  }, [slug])

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time)
  }

  const handlePlaybackTimeUpdate = (totalSeconds: number) => {
    audioPlaybackSecondsRef.current = totalSeconds
  }

  const handlePrevious = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(currentSentenceIndex - 1)
      setAutoPlayTrigger(prev => prev + 1)
    }
  }

  const handleNext = () => {
    if (sampleSentences && currentSentenceIndex < sampleSentences.length - 1) {
      const nextIndex = currentSentenceIndex + 1
      setCurrentSentenceIndex(nextIndex)
      setAutoPlayTrigger(prev => prev + 1)
      // 切换到下一句后，设置为已播放（延迟执行，确保在 useEffect 重置之后）
      setTimeout(() => {
        setHasPlayedCurrent(true)
      }, 0)
    }
  }

  // 播放按钮：第一次点击播放当前句子，第二次点击播放下一句
  const handlePlayOrNext = () => {
    if (hasPlayedCurrent) {
      // 已播放过，播放下一句
      handleNext()
    } else {
      // 第一次点击，播放当前句子
      setAutoPlayTrigger(prev => prev + 1)
      setHasPlayedCurrent(true)
    }
  }

  // 重置播放状态当句子索引改变
  useEffect(() => {
    setHasPlayedCurrent(false)
  }, [currentSentenceIndex])

  const handleComplete = (isCorrect: boolean, usedShowWords: boolean = false, duration?: number) => {
    const newCompleted = new Set(completedSentences)
    newCompleted.add(currentSentenceIndex)
    setCompletedSentences(newCompleted)
    if (isCorrect) {
      setCorrectCount(correctCount + 1)
      const newCorrectSet = new Set(correctSentences)
      newCorrectSet.add(currentSentenceIndex)
      setCorrectSentences(newCorrectSet)
    }

    // Fire-and-forget async operations
    if (user && materialId) {
      savePracticeRecord({
        userId: user.id,
        sentenceId: currentSentenceIndex,
        sentenceText: sampleSentences?.[currentSentenceIndex]?.text || '',
        practiceMode: mode,
        dictationMode: dictationMode,
        isCorrect,
        usedShowWords,
        audioTitle: audioTitle || DEFAULT_AUDIO_TITLE,
        materialId: materialId,  // 添加 materialId
        durationSeconds: (mode === 'dictation' ? (duration || 0) : Math.round(audioPlaybackSecondsRef.current)) || undefined,
      }).catch(err => console.error('Failed to save practice record:', err))

      if (mode === 'dictation') {
        const seconds = duration || 0
        const minutes = seconds / 60
        onDictationComplete(user.id, minutes).catch(err => console.error('Failed to update dictation streak:', err))
      } else {
        const seconds = Math.round(audioPlaybackSecondsRef.current)
        const minutes = seconds / 60
        onShadowingComplete(user.id, minutes).catch(err => console.error('Failed to update shadowing streak:', err))
      }
    }

    setIsRevealed(false)
    // Don't auto-advance - let user click Next button
  }

  // Adapter for DictationBox (matches expected signature)
  const handleDictationComplete = (isCorrect: boolean, usedShowWords?: boolean, practiceMinutes?: number) => {
    const durationSeconds = practiceMinutes ? practiceMinutes * 60 : undefined
    handleComplete(isCorrect, usedShowWords || false, durationSeconds)
  }

  // Adapter for WordMode (matches expected signature)
  const handleWordModeComplete = (isCorrect: boolean, usedShowWords?: boolean, durationSeconds?: number) => {
    handleComplete(isCorrect, usedShowWords || false, durationSeconds)
  }

  // Adapter for ShadowingPanel (matches expected signature)
  const handleShadowingComplete = (isCorrect: boolean, durationSeconds: number) => {
    handleComplete(isCorrect, false, durationSeconds)
  }

  const handleSentenceClick = (index: number) => {
    setCurrentSentenceIndex(index)
    setAutoPlayTrigger(prev => prev + 1)
  }

  // Calculate which words should be highlighted based on current playback time
  const getHighlightedWordIndex = (sentence: Sentence) => {
    if (currentTime < sentence.startTime || currentTime > sentence.endTime) {
      return -1 // Not playing this sentence
    }

    const progress = (currentTime - sentence.startTime) / (sentence.endTime - sentence.startTime)
    const words = sentence.text.split(' ')
    const highlightedIndex = Math.floor(progress * words.length)
    return Math.min(highlightedIndex, words.length - 1)
  }

  const currentSentence = sampleSentences?.[currentSentenceIndex]
  const isLastSentence = sampleSentences ? currentSentenceIndex === sampleSentences.length - 1 : false
  const isFirstSentence = currentSentenceIndex === 0

  if (isInitialLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{t("practice.loading")}</p>
        </div>
      </main>
    )
  }

  if (!currentSentence || !sampleSentences) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{materialError || t("practice.fetchError")}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <nav className="flex items-center text-sm">
            <a
              href="/topics"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault()
                window.location.href = '/topics'
              }}
              className="text-gray-500 hover:text-blue-600"
            >{t("practice.breadcrumb.topics")}</a>
            {materialCategory && (
              <>
                <span className="mx-2 text-gray-400">›</span>
                <a
                  href={`/topics#${materialCategory}`}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault()
                    // 跳转到素材页面并滚动到对应分类
                    window.location.href = `/topics#${materialCategory}`
                  }}
                  className="text-gray-500 hover:text-blue-600"
                >{getCategoryLabel(materialCategory, language)}</a>
              </>
            )}
            {audioTitle && (
              <>
                <span className="mx-2 text-gray-400">›</span>
                <span className="text-gray-700 font-medium">{audioTitle}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <h1 className="text-4xl font-bold text-slate-800">{audioTitle}</h1>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 md:static sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-center">
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                if (mode === 'shadowing') {
                  shadowingSentenceIndexRef.current = currentSentenceIndex
                }
                setMode("dictation")
                setCurrentSentenceIndex(dictationSentenceIndexRef.current)
                setCompletedSentences(new Set())
                setCorrectSentences(new Set())
                setIncorrectSentences(new Set())
                setCorrectCount(0)
                setShowTranscript(false)
                setIsRevealed(false)
              }}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "dictation"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {t("practice.mode.dictation")}
            </button>

            <button
              onClick={() => {
                if (mode === 'dictation') {
                  dictationSentenceIndexRef.current = currentSentenceIndex
                }
                setMode("shadowing")
                setCurrentSentenceIndex(shadowingSentenceIndexRef.current)
                setCompletedSentences(new Set())
                setCorrectSentences(new Set())
                setIncorrectSentences(new Set())
                setCorrectCount(0)
                setShowTranscript(false)
                setIsRevealed(false)
              }}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "shadowing"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {t("practice.mode.shadowing")}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-1 md:px-2 lg:px-2">
        {/* Three-Column Layout */}
        <div className="grid grid-cols-1 gap-4 lg:flex">
          {/* Left Column - Video/Audio Player (37%) */}
          <div className="bg-white rounded-lg shadow-sm p-4 lg:w-[37%] flex-shrink-0">
            <div className="text-center mb-3 text-sm text-gray-600">
              {currentSentenceIndex + 1} / {sampleSentences.length}
            </div>

            {/* Video Player */}
            <div className="mb-4">
              {videoUrl && currentSentence ? (
                <VideoPlayer
                  key={videoUrl}  // 当 videoUrl 变化时，强制重新挂载组件
                  thumbnailPath={thumbnailPath || undefined}
                  videoSrc={videoUrl}
                  currentSentence={currentSentence}
                  playbackRate={playbackRate}
                  autoPlayTrigger={autoPlayTrigger}
                  onPlayEnd={() => {
                    setHasPlayedCurrent(true)
                  }}
                  onTimeUpdate={handleTimeUpdate}
                  hasPlayedCurrent={hasPlayedCurrent}
                  onPlayNext={handleNext}
                />
              ) : null}
            </div>

            {/* Hidden Audio Player (for audio-only materials) */}
            {audioSrc && !videoUrl && currentSentence && (
              <div style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>
                <AudioPlayer
                  audioSrc={audioSrc}
                  currentSentence={currentSentence}
                  playbackRate={playbackRate}
                  autoPlayTrigger={autoPlayTrigger}
                  onPlayEnd={() => {}}
                  onTimeUpdate={() => {}}
                  onPlaybackTimeUpdate={() => {}}
                />
              </div>
            )}
          </div>

          {/* Middle Column - Practice Area (37%) */}
          <div className="lg:col-span-5 bg-white rounded-lg shadow-sm p-4 lg:w-[37%] flex-shrink-0">
            {/* Playback Controls */}
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handlePrevious}
                    disabled={isFirstSentence}
                    className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setAutoPlayTrigger(prev => prev + 1)
                      setHasPlayedCurrent(true)
                    }}
                    className="p-2 rounded-lg hover:bg-gray-200"
                    title="重播"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 4v6h6M23 20v-6h-6" />
                      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                    </svg>
                  </button>
                  <button
                    onClick={handlePlayOrNext}
                    className="p-2 rounded-lg hover:bg-gray-200"
                    title={hasPlayedCurrent ? "下一句" : "播放"}
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={isLastSentence}
                    className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-sm bg-white min-w-[60px]"
                  aria-label={t("practice.speed")}
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>

            {/* Practice Input Area */}
            {mode === 'dictation' ? (
              dictationMode === 'word' ? (
                <WordMode
                  sentence={currentSentence}
                  currentIndex={currentSentenceIndex}
                  totalSentences={sampleSentences.length}
                  onNext={handleNext}
                  isLastSentence={isLastSentence}
                  onComplete={handleWordModeComplete}
                  dictationMode={dictationMode}
                  onDictationModeChange={(newMode) => {
                    setDictationMode(newMode)
                    setCompletedSentences(new Set())
                    setCorrectSentences(new Set())
                    setIncorrectSentences(new Set())
                    setCorrectCount(0)
                    setIsRevealed(false)
                  }}
                />
              ) : (
                <DictationBox
                  sentence={currentSentence}
                  onComplete={handleDictationComplete}
                  onNext={handleNext}
                  isLastSentence={isLastSentence}
                  dictationMode={dictationMode}
                  onDictationModeChange={(newMode) => {
                    setDictationMode(newMode)
                    setCompletedSentences(new Set())
                    setCorrectSentences(new Set())
                    setIncorrectSentences(new Set())
                    setCorrectCount(0)
                    setIsRevealed(false)
                  }}
                />
              )
            ) : audioSrc ? (
              <ShadowingPanel
                sentence={currentSentence}
                audioSrc={audioSrc}
                onComplete={handleShadowingComplete}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            ) : null}
          </div>

          {/* Right Column - Transcript (26%) */}
          <div
            className="lg:col-span-3 bg-white rounded-lg shadow-sm p-4 max-h-[850px] overflow-y-auto scrollbar-thin lg:w-[26%] flex-shrink-0"
          >
            <div className="flex items-center justify-between mb-3 sticky top-0 bg-white py-1">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-base font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                {showTranscript ? '隐藏文稿' : '显示文稿'}
              </button>
            </div>
            <div className="space-y-2">
              {sampleSentences.map((sentence, index) => {
                const isCompleted = completedSentences.has(index)
                const isCurrent = index === currentSentenceIndex

                // 生成星号文本：每个单词用星号代替，保持单词长度
                const generateStarText = (text: string) => {
                  return text.split(' ').map(word => '*'.repeat(Math.min(word.length, 4))).join(' ')
                }

                return (
                  <div
                    key={sentence.id}
                    onClick={() => handleSentenceClick(index)}
                    className={`border rounded p-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                      isCurrent
                        ? "bg-blue-100 border-2 border-blue-500"
                        : isCompleted
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-sm font-semibold ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-blue-200 text-blue-700"
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-relaxed break-words">
                          {showTranscript ? sentence.text : generateStarText(sentence.text)}
                        </p>
                        {showTranscript && sentence.translation && (
                          <p className="text-xs text-gray-500 italic mt-1">
                            {sentence.translation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function DictationPracticeClient({ slug }: { slug: string }) {
  return <DictationPracticeClientContent slug={slug} />
}
