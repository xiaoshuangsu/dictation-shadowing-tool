"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import AudioPlayer from "@/components/AudioPlayer"
import DictationBox from "@/components/DictationBox"
import ShadowingPanel from "@/components/ShadowingPanel"
import WordMode from "@/components/WordMode"
import AuthButton from "@/components/auth/AuthButton"
import { useAuth } from "@/lib/hooks/useAuth"
import { savePracticeRecord } from "@/lib/supabase/client"
import { onDictationComplete, onShadowingComplete } from "@/lib/supabase/streak"

// 句子数据类型（translation 字段可选）
interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string  // 可选的中文翻译
}

// 硬编码 Supabase 配置（GitHub Pages 静态构建无法使用环境变量）
const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

// 默认音频标题（First Snowfall）
const DEFAULT_AUDIO_TITLE = "First Snowfall"

// 默认音频文件 URL（注意：不需要包含 basePath，Next.js 会自动处理）
const DEFAULT_AUDIO_SRC = "/learn-english-via-listening-1001.mp3"

// 默认句子数据（First Snowfall 的精确时间戳）
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

type PracticeMode = "dictation" | "shadowing"
type DictationMode = "word" | "whole"

// 内部组件：使用 useSearchParams
function HomeContent() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const materialId = searchParams.get('id')
  const practiceMode = searchParams.get('mode') as PracticeMode | null

  // 动态素材数据 - 初始值为 null，避免闪现旧标题
  const [audioTitle, setAudioTitle] = useState<string | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [sampleSentences, setSampleSentences] = useState<Sentence[] | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true) // 初始加载状态
  const [materialError, setMaterialError] = useState<string | null>(null)
  const [materialCategory, setMaterialCategory] = useState<string | null>(null)

  // 练习模式状态（需要在 useEffect 之前声明）
  const [mode, setMode] = useState<PracticeMode>("dictation")

  // Debug: Log user state
  useEffect(() => {
    console.log('Home page - Auth state:', {
      loading: authLoading,
      user: user ? { id: user.id, username: user.username } : null,
      isAuthenticated: !!user,
    })
  }, [authLoading, user])

  // 从 URL 参数加载素材数据
  useEffect(() => {
    async function loadMaterial() {
      if (!materialId) {
        // 没有 materialId，使用默认素材
        console.log('No material ID provided, using default material')
        setAudioTitle(DEFAULT_AUDIO_TITLE)
        setAudioSrc(DEFAULT_AUDIO_SRC)
        setSampleSentences(defaultSentences)
        setIsInitialLoading(false)
        return
      }

      setMaterialError(null)

      try {
        console.log('Loading material from Supabase:', materialId)

        const { data: material, error } = await supabase
          .from('materials')
          .select('id, title, category, audio_path, duration, transcript')
          .eq('id', materialId)
          .single()

        if (error) throw error

        if (!material) {
          throw new Error('Material not found')
        }

        console.log('Material loaded:', material)

        // 更新音频标题和分类
        setAudioTitle(material.title)
        setMaterialCategory(material.category)

        // 构建音频 URL（从 Supabase Storage）
        const supabaseAudioUrl = `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${material.audio_path}`
        setAudioSrc(supabaseAudioUrl)

        // 优先使用数据库中的 transcript 数据
        if (material.transcript && Array.isArray(material.transcript) && material.transcript.length > 0) {
          console.log('Using transcript from database:', material.transcript.length, 'sentences')
          setSampleSentences(material.transcript)
        } else {
          // 如果没有 transcript 数据，根据音频时长自动分割成固定长度的句子（每句约 10-15 秒）
          console.log('No transcript data, using auto-segmentation')
          const duration = material.duration || 60
          const sentenceDuration = 12 // 每句约 12 秒
          const sentences = []

          for (let i = 0; i < duration; i += sentenceDuration) {
            const endTime = Math.min(i + sentenceDuration, duration)
            sentences.push({
              id: sentences.length + 1,
              text: `Sentence ${sentences.length + 1}`, // 占位文本，用户可以听后自己输入
              startTime: i,
              endTime: endTime,
              translation: undefined  // 自动生成的句子没有翻译
            })
          }

          setSampleSentences(sentences)
          console.log(`Auto-segmented audio into ${sentences.length} sentences`)
        }

        console.log('Material loaded successfully:', {
          title: material.title,
          audioUrl: supabaseAudioUrl,
          duration: material.duration
        })

        setIsInitialLoading(false) // 数据加载完成，关闭初始加载状态

      } catch (error: any) {
        console.error('Failed to load material:', error)
        setMaterialError(error.message || 'Failed to load material')
        // 出错时使用默认素材
        setAudioTitle(DEFAULT_AUDIO_TITLE)
        setAudioSrc(DEFAULT_AUDIO_SRC)
        setSampleSentences(defaultSentences)
        setIsInitialLoading(false)
      }
    }

    loadMaterial()
  }, [materialId])

  // 根据 URL 参数设置练习模式
  useEffect(() => {
    if (practiceMode === 'dictation' || practiceMode === 'shadowing') {
      console.log('Setting practice mode from URL:', practiceMode)
      setMode(practiceMode)
      // 重置练习状态
      setCurrentSentenceIndex(0)
      setCompletedSentences(new Set())
      setCorrectSentences(new Set())
      setIncorrectSentences(new Set())
      setCorrectCount(0)
      setShowTranscript(false)
      setIsRevealed(false)
    }
  }, [practiceMode, materialId])

  const [dictationMode, setDictationMode] = useState<DictationMode>("word")
  const [correctCount, setCorrectCount] = useState(0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false) // Track if user used "Show Words"
  const [showSignupPrompt, setShowSignupPrompt] = useState(false) // 注册提醒弹窗

  // 跟踪主播放器的累计播放时间（Shadowing 使用）
  const [audioPlaybackSeconds, setAudioPlaybackSeconds] = useState(0)
  const audioPlaybackSecondsRef = useRef<number>(0)

  // 初始化状态：从 localStorage 恢复进度（如果已登录）
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0)
  const [progressRestored, setProgressRestored] = useState(false)

  // 保存练习进度到 localStorage
  const savePracticeProgress = (sentenceIndex: number) => {
    if (typeof window === 'undefined' || !user) return

    try {
      const progress = {
        sentenceIndex,
        mode,
        dictationMode,
        materialId, // 保存素材 ID
        audioTitle, // 保存素材标题
        category: materialCategory, // 保存分类
        timestamp: Date.now(),
      }
      localStorage.setItem(`practice_progress_${user.id}`, JSON.stringify(progress))
      console.log('Saved practice progress:', progress)
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }

  // 当用户登录后，恢复保存的进度状态
  useEffect(() => {
    if (user && !progressRestored && !authLoading) {
      try {
        const saved = localStorage.getItem(`practice_progress_${user.id}`)
        if (saved) {
          const progress = JSON.parse(saved)
          console.log('Found saved progress:', progress)

          // 恢复句子索引
          if (progress.sentenceIndex !== undefined && progress.sentenceIndex > 0) {
            setCurrentSentenceIndex(progress.sentenceIndex)
          }

          // 只有当 URL 没有 practiceMode 参数时，才恢复保存的模式
          // 这样可以避免覆盖从素材库跳转时指定的模式
          if (!practiceMode && progress.mode) {
            setMode(progress.mode)
          }
          if (progress.dictationMode) {
            setDictationMode(progress.dictationMode)
          }

          // 如果 URL 没有 materialId 参数，但有保存的 materialId，则加载保存的素材
          if (!materialId && progress.materialId && progress.audioTitle) {
            console.log('Restoring material from saved progress:', progress.materialId)
            setAudioTitle(progress.audioTitle)
            if (progress.category) {
              setMaterialCategory(progress.category)
            }
            // 从 Supabase 加载素材数据
            loadMaterialById(progress.materialId, progress.category)
          }
        }
        setProgressRestored(true)
      } catch (error) {
        console.error('Failed to restore progress:', error)
        setProgressRestored(true)
      }
    } else if (!user) {
      // 用户登出时重置状态
      setProgressRestored(false)
    }
  }, [user, authLoading, progressRestored, materialId])

  // 加载素材的辅助函数
  const loadMaterialById = async (id: string, category?: string | null) => {
    try {
      console.log('Loading material by ID:', id)
      const { data: material, error } = await supabase
        .from('materials')
        .select('id, title, category, audio_path, duration, transcript')
        .eq('id', id)
        .single()

      if (error) throw error
      if (!material) throw new Error('Material not found')

      // 构建音频 URL
      const supabaseAudioUrl = `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${material.audio_path}`
      setAudioSrc(supabaseAudioUrl)
      if (material.category) {
        setMaterialCategory(material.category)
      }

      // 使用 transcript 或自动分割
      if (material.transcript && Array.isArray(material.transcript) && material.transcript.length > 0) {
        setSampleSentences(material.transcript)
      } else {
        const duration = material.duration || 60
        const sentenceDuration = 12
        const sentences = []
        for (let i = 0; i < duration; i += sentenceDuration) {
          const endTime = Math.min(i + sentenceDuration, duration)
          sentences.push({
            id: sentences.length + 1,
            text: `Sentence ${sentences.length + 1}`,
            startTime: i,
            endTime: endTime
          })
        }
        setSampleSentences(sentences)
      }

      console.log('Material loaded from saved progress:', material.title)
    } catch (error) {
      console.error('Failed to load material from saved progress:', error)
    }
  }

  // 当句子改变时重置播放时间
  useEffect(() => {
    setAudioPlaybackSeconds(0)
    audioPlaybackSecondsRef.current = 0
    console.log('Reset audio playback time for new sentence')
  }, [currentSentenceIndex])

  const currentSentence = sampleSentences?.[currentSentenceIndex]

  // Show signup prompt for non-logged in users
  useEffect(() => {
    // Only show prompt if auth is initialized, user is not logged in, and hasn't dismissed
    if (!authLoading && !user) {
      const hasDismissed = localStorage.getItem('signupPromptDismissed')
      if (!hasDismissed) {
        // Delay showing the prompt to ensure user sees the page first
        const timer = setTimeout(() => {
          setShowSignupPrompt(true)
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
    // Hide prompt if user logs in
    if (user) {
      setShowSignupPrompt(false)
    }
  }, [authLoading, user])

  // Auto-play when sentence index changes
  useEffect(() => {
    if (currentSentenceIndex > 0) {
      setAutoPlayTrigger(prev => prev + 1)
    }
    // 保存进度
    savePracticeProgress(currentSentenceIndex)
  }, [currentSentenceIndex])

  const handleNext = () => {
    if (sampleSentences && currentSentenceIndex < sampleSentences.length - 1) {
      const newIndex = currentSentenceIndex + 1
      setCurrentSentenceIndex(newIndex)
      savePracticeProgress(newIndex)
    }
  }

  const handlePrevious = () => {
    if (currentSentenceIndex > 0) {
      const newIndex = currentSentenceIndex - 1
      setCurrentSentenceIndex(newIndex)
      savePracticeProgress(newIndex)
    }
  }

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time)
  }

  // 接收 AudioPlayer 的累计播放时间
  const handlePlaybackTimeUpdate = (totalPlayedSeconds: number) => {
    setAudioPlaybackSeconds(totalPlayedSeconds)
    audioPlaybackSecondsRef.current = totalPlayedSeconds
    console.log(`Main page - Audio playback time updated: ${totalPlayedSeconds.toFixed(2)}s`)
  }

  const handleComplete = async (
    sentenceId: number,
    isCorrect: boolean,
    usedShowWords: boolean = false,
    duration?: number // Dictation: minutes, Shadowing: seconds
  ) => {
    // Update local state (existing logic)
    const newCompleted = new Set(completedSentences)
    newCompleted.add(sentenceId)
    setCompletedSentences(newCompleted)
    if (isCorrect) {
      setCorrectCount(correctCount + 1)
      const newCorrectSet = new Set(correctSentences)
      newCorrectSet.add(sentenceId)
      setCorrectSentences(newCorrectSet)
    } else {
      setIncorrectSentences(new Set(incorrectSentences))
      const newIncorrectSet = new Set(incorrectSentences)
      newIncorrectSet.add(sentenceId)
      setIncorrectSentences(newIncorrectSet)
    }

    // Save to Supabase if user is logged in
    if (user && currentSentence) {
      try {
        // V3.1 数据留存：保存到 practice_records（数据库存秒）
        await savePracticeRecord({
          userId: user.id,
          sentenceId,
          sentenceText: currentSentence.text,
          practiceMode: mode,
          dictationMode: mode === 'dictation' ? dictationMode : undefined,
          isCorrect,
          usedShowWords,
          audioTitle: audioTitle || DEFAULT_AUDIO_TITLE, // 如果为 null，使用默认标题
          // Dictation 和 Shadowing 都保存秒数
          durationSeconds: (mode === 'dictation' ? (duration || 0) : Math.round(audioPlaybackSecondsRef.current)) || undefined,
        })

        // V3 数据留存：更新连胜和统计数据（统计表存分钟）
        if (mode === 'dictation') {
          // Dictation: duration 是秒数，转换为分钟
          const seconds = duration || 0
          const minutes = seconds / 60
          console.log('handleComplete - Dictation complete with effective seconds:', seconds, 'minutes:', minutes)
          await onDictationComplete(user.id, minutes)
        } else if (mode === 'shadowing') {
          // Shadowing: 使用主播放器的累计播放时间（秒），转换为分钟
          const seconds = Math.round(audioPlaybackSecondsRef.current)
          const minutes = seconds / 60
          console.log('handleComplete - Shadowing complete with audio playback seconds:', seconds, 'minutes:', minutes)
          await onShadowingComplete(user.id, minutes)
        }

        console.log(`Practice data saved (${mode})`)

        // 保存下一句的进度（如果不是最后一句）
        if (!isLastSentence) {
          const nextIndex = currentSentenceIndex + 1
          savePracticeProgress(nextIndex)
          console.log('Saved next sentence progress:', nextIndex)
        }
      } catch (error) {
        console.error('Failed to save practice data:', error)
        // Don't show error to user - practice continues normally
      }
    }

    // Reset the revealed state for next sentence
    setIsRevealed(false)
  }

  const handleSentenceClick = (index: number) => {
    setCurrentSentenceIndex(index)
    setAutoPlayTrigger(prev => prev + 1)
    savePracticeProgress(index)
  }

  // Calculate which words should be highlighted based on current playback time
  const getHighlightedWordIndex = (sentence: NonNullable<typeof sampleSentences>[0]) => {
    if (currentTime < sentence.startTime || currentTime > sentence.endTime) {
      return -1 // Not playing this sentence
    }

    const progress = (currentTime - sentence.startTime) / (sentence.endTime - sentence.startTime)
    const words = sentence.text.split(' ')
    const highlightedIndex = Math.floor(progress * words.length)
    return Math.min(highlightedIndex, words.length - 1)
  }

  const isLastSentence = sampleSentences ? currentSentenceIndex === sampleSentences.length - 1 : false
  const isFirstSentence = currentSentenceIndex === 0

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/materials" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
            素材库
          </Link>
          <AuthButton />
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <nav className="flex items-center text-sm" aria-label="Breadcrumb">
            <Link href="/" className="text-gray-500 hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span className="mx-2 text-gray-400">»</span>
            <Link href="/materials" className="text-gray-500 hover:text-blue-600 transition-colors">
              Materials
            </Link>
            {materialCategory && (
              <>
                <span className="mx-2 text-gray-400">»</span>
                <Link
                  href={`/materials#${materialCategory}`}
                  className="text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {materialCategory}
                </Link>
              </>
            )}
            {audioTitle && (
              <>
                <span className="mx-2 text-gray-400">»</span>
                <span className="text-gray-700 font-medium">{audioTitle}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Material Title */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <h1 className="text-4xl font-bold text-slate-800">{audioTitle}</h1>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-center">
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setMode("dictation")
                setCurrentSentenceIndex(0)
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
              Dictation
            </button>
            <button
              onClick={() => {
                setMode("shadowing")
                setCurrentSentenceIndex(0)
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
              Shadowing
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Error state */}
        {materialError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{materialError}</p>
          </div>
        )}

        {/* 初始加载骨架屏 */}
        {isInitialLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <div className="animate-pulse space-y-4">
              {/* 标题骨架 */}
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>

              {/* 进度骨架 */}
              <div className="h-3 bg-gray-200 rounded w-1/4 mx-auto"></div>

              {/* 控制栏骨架 */}
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div className="h-8 w-8 bg-gray-300 rounded"></div>
                  <div className="h-10 flex-1 mx-4 bg-gray-300 rounded"></div>
                  <div className="h-8 w-8 bg-gray-300 rounded"></div>
                </div>
              </div>

              {/* 输入框骨架 */}
              <div className="space-y-3">
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ) : (
          <>

        {/* Dictation Mode Sub-toggle (only show in Dictation mode) */}
        {mode === "dictation" && (
          <div className="flex justify-start mb-4 items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Dictation mode:
            </span>
            <div className="relative">
              <select
                value={dictationMode}
                onChange={(e) => {
                  const newMode = e.target.value as "word" | "whole"
                  setDictationMode(newMode)
                  setCurrentSentenceIndex(0)
                  setCompletedSentences(new Set())
                  setCorrectSentences(new Set())
                  setIncorrectSentences(new Set())
                  setCorrectCount(0)
                  setIsRevealed(false)
                }}
                className="appearance-none pr-8 pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="word">Word</option>
                <option value="whole">Whole Caption</option>
              </select>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          {/* Progress */}
          <div className="text-center mb-4 text-sm text-gray-600">
            {sampleSentences && `${currentSentenceIndex + 1} / ${sampleSentences.length}`}
          </div>

          {/* Top Control Bar */}
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              {/* Navigation Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevious}
                  disabled={isFirstSentence}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {audioSrc && currentSentence && (
                  <AudioPlayer
                    audioSrc={audioSrc}
                    currentSentence={currentSentence}
                    playbackRate={playbackRate}
                    autoPlayTrigger={autoPlayTrigger}
                    onPlayEnd={() => {}}
                    onTimeUpdate={handleTimeUpdate}
                    onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
                  />
                )}

                <button
                  onClick={handleNext}
                  disabled={isLastSentence}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Speed:</span>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-sm bg-white"
                >
                  <option value="0.25">0.25x</option>
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="1.75">1.75x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>
          </div>

          {/* Practice Area */}
          {sampleSentences && currentSentence && (
            mode === "dictation" ? (
              dictationMode === "word" ? (
                <WordMode
                  sentence={currentSentence}
                  onComplete={(isCorrect, usedShowWords, durationSeconds) => handleComplete(currentSentence.id, isCorrect, usedShowWords, durationSeconds)}
                  currentIndex={currentSentenceIndex}
                  totalSentences={sampleSentences.length}
                  onNext={handleNext}
                  isLastSentence={isLastSentence}
                />
              ) : (
                <DictationBox
                  sentence={currentSentence}
                  onComplete={(isCorrect, usedShowWords, durationSeconds) => handleComplete(currentSentence.id, isCorrect, usedShowWords, durationSeconds)}
                  onNext={handleNext}
                  isLastSentence={isLastSentence}
                />
              )
            ) : (
              <ShadowingPanel
                sentence={currentSentence}
                onComplete={(isCorrect, durationSeconds) => handleComplete(currentSentence.id, isCorrect, false, durationSeconds)}
                onNext={handleNext}
                isLastSentence={isLastSentence}
              />
            )
          )}

          {/* Correct Counter */}
          {sampleSentences && (
            <div className="text-center mt-4 mb-4">
              <div className="text-sm text-gray-600 font-medium">
                Correct: {correctCount} / {sampleSentences.length}
              </div>
            </div>
          )}
        </div>

        {/* Show Transcript Button */}
        <div className="text-center">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </button>
        </div>

        {/* Transcript Section */}
        {showTranscript && sampleSentences && (
          <div className="mt-4 bg-white rounded-lg shadow-sm p-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Transcript</h3>
            <div className="space-y-3">
              {sampleSentences.map((sentence, index) => {
                const isCompleted = completedSentences.has(sentence.id)
                const isCorrect = correctSentences.has(sentence.id)
                const isIncorrect = incorrectSentences.has(sentence.id)

                return (
                  <div
                    key={sentence.id}
                    onClick={() => handleSentenceClick(index)}
                    className={`border rounded-lg p-3 relative cursor-pointer hover:bg-blue-100 transition-colors ${
                      index === currentSentenceIndex
                        ? "bg-blue-50 border-2 border-blue-500"
                        : isCompleted
                        ? "border-green-500 bg-green-50"
                        : "border-blue-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      {/* Sentence Number */}
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-blue-200 text-blue-700"
                        }`}>
                          {index + 1}
                        </span>
                      </div>

                      {/* Sentence Content - Always show text in transcript with word-level highlighting */}
                      <div className="flex-1">
                        <p className={`text-sm ${
                          mode === "shadowing"
                            ? isCorrect
                              ? "text-green-800"
                              : isIncorrect
                              ? "text-orange-800"
                              : "text-gray-800"
                            : "text-gray-800"
                        }`}>
                          {sentence.text.split(' ').map((word, wordIndex) => {
                            const highlightedWordIndex = index === currentSentenceIndex ? getHighlightedWordIndex(sentence) : -1
                            const isHighlighted = wordIndex <= highlightedWordIndex
                            const isCurrentWord = wordIndex === highlightedWordIndex

                            return (
                              <span
                                key={wordIndex}
                                className={
                                  isCurrentWord
                                    ? "bg-yellow-300 rounded px-1 font-semibold"
                                    : isHighlighted && index === currentSentenceIndex
                                    ? "bg-yellow-100 rounded px-1"
                                    : ""
                                }
                              >
                                {word}{' '}
                              </span>
                            )
                          })}
                        </p>

                        {/* 中文翻译 */}
                        {sentence.translation && (
                          <p className="text-xs text-gray-600 italic mt-1">
                            {sentence.translation}
                          </p>
                        )}
                      </div>

                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {mode === "shadowing" ? (
                          // Shadowing: 显示正确性图标
                          isCorrect ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : isIncorrect ? (
                            <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : null
                        ) : (
                          // Dictation: 已完成显示勾
                          isCompleted ? (
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : null
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Completion Message */}
        {sampleSentences && completedSentences.size === sampleSentences.length && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-700 font-medium">
              🎉 Congratulations! You've completed all sentences! Accuracy: {Math.round((correctCount / sampleSentences.length) * 100)}%
            </p>
          </div>
        )}
        </>
        )}
      </div>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              解锁您的学习进度
            </h2>

            <p className="text-gray-600 mb-6">
              注册账号即可保存练习记录，追踪学习进度，查看详细统计数据。
            </p>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">自动保存练习记录</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">查看详细统计数据</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">追踪学习进度</span>
              </li>
            </ul>

            <div className="flex gap-3 mb-4">
              <Link
                href="/register"
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
              >
                免费注册
              </Link>
              <Link
                href="/login"
                className="flex-1 py-3 px-4 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                登录
              </Link>
            </div>

            <button
              onClick={() => {
                setShowSignupPrompt(false)
                localStorage.setItem('signupPromptDismissed', 'true')
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              暂不注册，继续练习
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

// Export with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}
