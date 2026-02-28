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

export function ShadowingPracticeClientContent({ slug }: { slug: string }) {
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

  const [mode, setMode] = useState<PracticeMode>("shadowing")
  const [dictationMode, setDictationMode] = useState<DictationMode>("word")
  const [isDictationModeOpen, setIsDictationModeOpen] = useState(false)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(startIndex)
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [correctCount, setCorrectCount] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)

  // 为每个模式独立保存进度
  const shadowingProgressRef = useRef({
    currentIndex: 0,
    completedSentences: new Set<number>(),
    correctSentences: new Set<number>(),
    incorrectSentences: new Set<number>(),
    correctCount: 0
  })

  const dictationProgressRef = useRef({
    currentIndex: 0,
    completedSentences: new Set<number>(),
    correctSentences: new Set<number>(),
    incorrectSentences: new Set<number>(),
    correctCount: 0
  })

  const audioPlaybackSecondsRef = useRef(0)

  // 初始化两个模式的进度 ref
  useEffect(() => {
    // 只在第一次渲染时初始化
    shadowingProgressRef.current = {
      currentIndex: startIndex,
      completedSentences: new Set(),
      correctSentences: new Set(),
      incorrectSentences: new Set(),
      correctCount: 0
    }

    dictationProgressRef.current = {
      currentIndex: startIndex,
      completedSentences: new Set(),
      correctSentences: new Set(),
      incorrectSentences: new Set(),
      correctCount: 0
    }
  }, []) // 只在挂载时执行一次

  useEffect(() => {
    async function findMaterial() {
      const titleToSlug = (title: string) =>
        title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_]+/g, '-')
          .replace(/^-+|-+$/g, '')

      try {
        const { data: materials } = await supabase
          .from('materials')
          .select('*')

        const material = materials?.find(m => m.id === slug || titleToSlug(m.title) === slug)

        if (material) {
          setMaterialId(material.id)
          setAudioTitle(material.title)
          setAudioSrc(material.audio_path)
          setMaterialCategory(material.category)

          // 🆕 检测是否为 R2 URL（通过检查 audio_path）
          const isR2Url = material.audio_path && material.audio_path.includes('r2-proxy')

          if (isR2Url) {
            // R2 音频 URL → 视频URL
            const videoUrl = material.audio_path.replace('/audio/', '/videos/').replace('.mp3', '.mp4')
            setVideoUrl(videoUrl)
            // 设置封面路径
            if (material.thumbnail_path) {
              setThumbnailPath(material.thumbnail_path)
            }
            console.log('✅ 使用 R2 URL（中国可访问）')
          }


          setMaterialCategory(material.category)

          // Use transcript from material (like the original practice page)
          if (material.transcript && Array.isArray(material.transcript) && material.transcript.length > 0) {
            console.log(`Loaded transcript with ${material.transcript.length} sentences`)
            // Convert startTime and endTime from strings to numbers
            const transcript = material.transcript.map((s: any) => ({
              ...s,
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
      setCurrentSentenceIndex(currentSentenceIndex + 1)
      setAutoPlayTrigger(prev => prev + 1)
    }
  }

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
        materialId: materialId,
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
    // 不自动跳转，让用户手动点击"下一句"按钮
    console.log("handleComplete: Not auto-advancing. User must click Next button.")
  }

  // Adapter for DictationBox (matches expected signature)
  // Dictation 模式不自动跳转，让用户手动点击"下一句"按钮
  const handleDictationComplete = (isCorrect: boolean, usedShowWords?: boolean, practiceMinutes?: number) => {
    const durationSeconds = practiceMinutes ? practiceMinutes * 60 : undefined

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
        practiceMode: 'dictation',
        dictationMode: dictationMode,
        isCorrect,
        usedShowWords: usedShowWords || false,
        audioTitle: audioTitle || DEFAULT_AUDIO_TITLE,
        materialId: materialId,
        durationSeconds: durationSeconds || undefined,
      }).catch(err => console.error('Failed to save practice record:', err))

      const minutes = (durationSeconds || 0) / 60
      onDictationComplete(user.id, minutes).catch(err => console.error('Failed to update dictation streak:', err))
    }

    setIsRevealed(false)
    // 不自动跳转，让用户手动点击"下一句"按钮
    console.log("Dictation complete, not auto-advancing. User must click Next button.")
  }

  // Adapter for WordMode (matches expected signature)
  // Word 模式不自动跳转，让用户手动点击"下一句"按钮
  const handleWordModeComplete = (isCorrect: boolean, usedShowWords?: boolean, durationSeconds?: number) => {
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
        practiceMode: 'dictation',
        dictationMode: 'word',
        isCorrect,
        usedShowWords: usedShowWords || false,
        audioTitle: audioTitle || DEFAULT_AUDIO_TITLE,
        materialId: materialId,
        durationSeconds: durationSeconds || undefined,
      }).catch(err => console.error('Failed to save practice record:', err))

      const minutes = (durationSeconds || 0) / 60
      onDictationComplete(user.id, minutes).catch(err => console.error('Failed to update dictation streak:', err))
    }

    setIsRevealed(false)
    // 不自动跳转，让用户手动点击"下一句"按钮
    console.log("Word mode complete, not auto-advancing. User must click Next button.")
  }

  // Adapter for ShadowingPanel (matches expected signature)
  // Shadowing 模式不自动跳转，让用户手动点击"下一句"按钮
  const handleShadowingComplete = (isCorrect: boolean, durationSeconds: number) => {
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
        practiceMode: 'shadowing',
        dictationMode: undefined,
        isCorrect,
        usedShowWords: false,
        audioTitle: audioTitle || DEFAULT_AUDIO_TITLE,
        materialId: materialId,
        durationSeconds: durationSeconds,
      }).catch(err => console.error('Failed to save practice record:', err))

      const minutes = durationSeconds / 60
      onShadowingComplete(user.id, minutes).catch(err => console.error('Failed to update shadowing streak:', err))
    }

    setIsRevealed(false)
    // 不自动跳转，让用户手动点击"下一句"按钮
    console.log("Shadowing complete, not auto-advancing. User must click Next button.")
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
            <LocalizedLink href="/topics" className="text-gray-500 hover:text-blue-600">{t("practice.breadcrumb.topics")}</LocalizedLink>
            {materialCategory && (
              <>
                <span className="mx-2 text-gray-400">›</span>
                <LocalizedLink href={`/topics#${materialCategory}`} className="text-gray-500 hover:text-blue-600">{getCategoryLabel(materialCategory, language)}</LocalizedLink>
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

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-center">
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            {/* 听写按钮 - 带下拉框 */}
            <div className="relative">
              <button
                onClick={() => {
                  if (mode === "dictation") {
                    // 如果已经在听写模式，切换下拉菜单
                    setIsDictationModeOpen(!isDictationModeOpen)
                  } else {
                    // 如果不在听写模式，切换到听写模式
                    // 保存 Shadowing 模式的进度
                    shadowingProgressRef.current = {
                      currentIndex: currentSentenceIndex,
                      completedSentences: new Set(completedSentences),
                      correctSentences: new Set(correctSentences),
                      incorrectSentences: new Set(incorrectSentences),
                      correctCount
                    }

                    // 恢复 Dictation 模式的进度
                    const dictationProgress = dictationProgressRef.current
                    setCurrentSentenceIndex(dictationProgress.currentIndex)
                    setCompletedSentences(new Set(dictationProgress.completedSentences))
                    setCorrectSentences(new Set(dictationProgress.correctSentences))
                    setIncorrectSentences(new Set(dictationProgress.incorrectSentences))
                    setCorrectCount(dictationProgress.correctCount)

                    setMode("dictation")
                    setShowTranscript(false)
                    setIsRevealed(false)
                  }
                }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  mode === "dictation"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {t("practice.mode.dictation")}
                <svg className={`w-4 h-4 transition-transform ${isDictationModeOpen && mode === "dictation" ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 下拉菜单 - 单词/整句 */}
              {isDictationModeOpen && mode === "dictation" && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setDictationMode('word')
                      setIsDictationModeOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      dictationMode === 'word' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {t("practice.dictationMode.word")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDictationMode('whole')
                      setIsDictationModeOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      dictationMode === 'whole' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {t("practice.dictationMode.whole")}
                  </button>
                </div>
              )}
            </div>

            {/* 影子跟读按钮 */}
            <button
              onClick={() => {
                // 保存 Dictation 模式的进度
                dictationProgressRef.current = {
                  currentIndex: currentSentenceIndex,
                  completedSentences: new Set(completedSentences),
                  correctSentences: new Set(correctSentences),
                  incorrectSentences: new Set(incorrectSentences),
                  correctCount
                }

                // 恢复 Shadowing 模式的进度
                const shadowingProgress = shadowingProgressRef.current
                setCurrentSentenceIndex(shadowingProgress.currentIndex)
                setCompletedSentences(new Set(shadowingProgress.completedSentences))
                setCorrectSentences(new Set(shadowingProgress.correctSentences))
                setIncorrectSentences(new Set(shadowingProgress.incorrectSentences))
                setCorrectCount(shadowingProgress.correctCount)

                setMode("shadowing")
                setShowTranscript(false)
                setIsRevealed(false)
                setIsDictationModeOpen(false)
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

      <div className="max-w-7xl mx-auto p-2 lg:p-4">
        {/* Three-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3">
          {/* Left Column - Video/Audio Player (5/12 ≈ 42%) */}
          <div className="lg:col-span-5 bg-white rounded-lg shadow-sm p-4">
            <div className="text-center mb-3 text-sm text-gray-600">
              {currentSentenceIndex + 1} / {sampleSentences.length}
            </div>

            {/* Video or Audio Player */}
            <div className="mb-4">
              {videoUrl && currentSentence ? (
                <VideoPlayer
                  thumbnailPath={thumbnailPath || undefined}
                  videoSrc={videoUrl}
                  currentSentence={currentSentence}
                  playbackRate={playbackRate}
                  autoPlayTrigger={autoPlayTrigger}
                  onPlayEnd={() => {}}
                  onTimeUpdate={handleTimeUpdate}
                />
              ) : audioSrc && currentSentence ? (
                <AudioPlayer
                  audioSrc={audioSrc}
                  currentSentence={currentSentence}
                  playbackRate={playbackRate}
                  autoPlayTrigger={autoPlayTrigger}
                  onPlayEnd={() => {}}
                  onTimeUpdate={handleTimeUpdate}
                  onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
                />
              ) : null}
            </div>
          </div>

          {/* Middle Column - Practice Area (4/12 ≈ 33%) */}
          <div className="lg:col-span-4 bg-white rounded-lg shadow-sm p-4">
            {/* Progress Indicator */}
            <div className="flex justify-center items-center gap-2 mb-3 text-sm text-gray-600">
              <span className="font-medium">练习区域</span>
              <span className="text-gray-400">•</span>
              <span>Progress</span>
              <span className="text-blue-600 font-medium">
                {completedSentences.size} / {sampleSentences.length}
              </span>
            </div>

            {/* Playback Controls */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center">
                {/* Left: Control Buttons */}
                <div className="flex items-center gap-2">
                  {/* Previous Button */}
                  <button
                    onClick={handlePrevious}
                    disabled={isFirstSentence}
                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Repeat Button */}
                  <button
                    onClick={() => setAutoPlayTrigger(prev => prev + 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-200"
                    title="Repeat"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  {/* Play/Pause Button */}
                  <button
                    onClick={() => setAutoPlayTrigger(prev => prev + 1)}
                    className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    title="Play"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={handleNext}
                    disabled={isLastSentence}
                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Right: Speed Selector */}
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1.5 text-sm bg-white min-w-[70px]"
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
                />
              ) : (
                <DictationBox
                  sentence={currentSentence}
                  onComplete={handleDictationComplete}
                  onNext={handleNext}
                  isLastSentence={isLastSentence}
                />
              )
            ) : audioSrc ? (
              <ShadowingPanel
                sentence={currentSentence}
                audioSrc={audioSrc}
                currentTime={currentTime}
                onComplete={handleShadowingComplete}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            ) : null}
          </div>

          {/* Right Column - Transcript (3/12 = 25%) */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-4 max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sticky top-0 bg-white py-1">
              <h3 className="text-base font-semibold text-gray-800">原文</h3>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                {showTranscript ? '隐藏原文' : '显示原文'}
              </button>
            </div>
            <div className="space-y-2">
              {sampleSentences.map((sentence, index) => {
                const isCompleted = completedSentences.has(index)
                const isCorrect = correctSentences.has(index)
                const isIncorrect = incorrectSentences.has(index)
                const isCurrent = index === currentSentenceIndex

                // 计算当前播放的单词索引（仅对当前播放的句子）
                let currentWordIndex = -1
                if (isCurrent && currentTime >= sentence.startTime && currentTime <= sentence.endTime) {
                  const words = sentence.text.split(/\s+/)
                  const duration = sentence.endTime - sentence.startTime
                  const progress = currentTime - sentence.startTime
                  currentWordIndex = Math.floor((progress / duration) * words.length)
                }

                // 将句子分割成单词，便于高亮
                const words = sentence.text.split(/(\s+)/)

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
                        {showTranscript ? (
                          isCurrent ? (
                            <p className="text-sm text-gray-800 leading-relaxed">
                              {words.map((word, i) => {
                                const isWord = word.trim().length > 0
                                const wordIndex = Math.floor(i / 2) // 因为分割包含空格
                                const isCurrentWord = isCurrent && wordIndex === currentWordIndex

                                return (
                                  <span
                                    key={i}
                                    className={isCurrentWord ? "bg-yellow-300 px-0.5 rounded font-semibold" : ""}
                                  >
                                    {word}
                                  </span>
                                )
                              })}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-800 leading-relaxed break-words">
                              {sentence.text}
                            </p>
                          )
                        ) : (
                          <p className="text-sm text-gray-400 leading-relaxed break-words">
                            {'*'.repeat(Math.min(sentence.text.length, 30))}
                          </p>
                        )}
                        {sentence.translation && (
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

export default function ShadowingPracticeClient({ slug }: { slug: string }) {
  return <ShadowingPracticeClientContent slug={slug} />
}
