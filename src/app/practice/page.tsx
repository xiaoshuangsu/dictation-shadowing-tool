"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import AudioPlayer from "@/components/AudioPlayer"
import VideoPlayer from "@/components/VideoPlayer"
import DictationBox from "@/components/DictationBox"
import ShadowingPanel from "@/components/ShadowingPanel"
import WordMode from "@/components/WordMode"
import AuthButton from "@/components/auth/AuthButton"
import { DebugLogger } from "@/components/DebugLogger"
import { useAuth } from "@/lib/hooks/useAuth"
import { supabase } from "@/lib/supabase/client"
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

// R2 URL 配置（统一使用 Worker 代理）
const R2_WORKER_URL = 'https://media.shadowhub.app'

// 根据设备类型选择合适的 CDN URL（使用 R2 Worker 代理）
const getCdnUrl = (url: string | null) => {
  if (!url) return null
  if (typeof window === 'undefined') return url

  // 完整 URL：直接使用
  if (url.startsWith('http')) {
    return url
  }

  // 相对路径：使用 R2 Worker 代理
  let finalUrl = `${R2_WORKER_URL}/${url}`

  // 🔴 关键修复：强制补全 .mp4 后缀
  // 如果是视频路径但没有 .mp4 后缀，自动添加
  if (url.includes('video') && !url.endsWith('.mp4')) {
    finalUrl = `${finalUrl}.mp4`
    console.log('🔧 Auto-added .mp4 extension:', {
      original: url,
      fixed: finalUrl.replace(R2_WORKER_URL, '')
    })
  }

  // 验证并记录视频路径
  if (url.includes('.mp4') || url.includes('videos/')) {
    console.log('🎬 Video URL constructed:', {
      original: url,
      final: finalUrl,
      hasMp4Extension: finalUrl.endsWith('.mp4')
    })
  }

  return finalUrl
}

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
  const startParam = searchParams.get('start') // 获取起始句子索引参数

  // 动态素材数据 - 初始值为 null，避免闪现旧标题
  const [audioTitle, setAudioTitle] = useState<string | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null) // 视频源
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null) // 缩略图
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
      let targetMaterialId = materialId

      // 如果 URL 没有 materialId，尝试从 localStorage 恢复
      if (!materialId) {
        const savedMaterialId = localStorage.getItem('currentMaterialId')
        if (savedMaterialId) {
          console.log('🔄 Restoring material ID from localStorage:', savedMaterialId)
          targetMaterialId = savedMaterialId
        }
      }

      if (!targetMaterialId) {
        // 没有 materialId，显示提示引导用户选择素材
        console.log('⚠️ No material ID provided, showing selection prompt')
        setIsInitialLoading(false)
        setMaterialError('请先从素材页面选择一个练习内容')
        // 不再使用默认素材
        return
      }

      // 保存 materialId 到 localStorage（用于刷新后恢复）
      localStorage.setItem('currentMaterialId', targetMaterialId)
      console.log('💾 Saved material ID to localStorage:', targetMaterialId)

      setMaterialError(null)

      try {
        console.log('Loading material from Supabase:', targetMaterialId)

        const { data: material, error } = await supabase
          .from('materials')
          .select('id, title, category, audio_path, video_path, thumbnail_path, duration, transcript')
          .eq('id', targetMaterialId)
          .single()

        if (error) throw error

        if (!material) {
          throw new Error('Material not found')
        }

        console.log('Material loaded:', material)

        // 更新音频标题和分类
        setAudioTitle(material.title)
        setMaterialCategory(material.category)

        // 构建音频 URL
        const audioUrl = getCdnUrl(material.audio_path)
        console.log('Audio URL:', audioUrl?.substring(0, 60))
        setAudioSrc(audioUrl)

        // 构建视频 URL（如果有）
        if (material.video_path) {
          const videoUrl = getCdnUrl(material.video_path)

          // 🔴 关键验证：确保 videoSrc 以 .mp4 结尾
          if (!videoUrl.endsWith('.mp4')) {
            console.error('❌ Video URL missing .mp4 extension:', {
              original: material.video_path,
              constructed: videoUrl
            })
            // 强制补全
            videoUrl = `${videoUrl}.mp4`
            console.log('🔧 Force-fixed video URL:', videoUrl)
          }

          setVideoSrc(videoUrl)
          console.log('✅ Final Video URL:', videoUrl?.substring(0, 60))
        } else {
          setVideoSrc(null)
        }

        // 构建缩略图 URL（如果有）
        if (material.thumbnail_path) {
          const thumbnailUrl = getCdnUrl(material.thumbnail_path)
          setThumbnailPath(thumbnailUrl)
          console.log('Thumbnail URL:', thumbnailUrl?.substring(0, 60))
        }

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
          audioUrl: audioUrl,
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
  const [audioLoading, setAudioLoading] = useState(false) // 音频加载状态
  const shouldSkipAutoPlayRef = useRef(false) // 使用 ref 来标记是否跳过自动播放

  // 跟踪主播放器的累计播放时间（Shadowing 使用）
  const [audioPlaybackSeconds, setAudioPlaybackSeconds] = useState(0)
  const audioPlaybackSecondsRef = useRef<number>(0)

  // 为每个模式独立保存句子索引
  const dictationSentenceIndexRef = useRef(0)
  const shadowingSentenceIndexRef = useRef(0)

  // 初始化状态：从 localStorage 恢复进度（如果已登录）
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0)
  const [progressRestored, setProgressRestored] = useState(false)

  // 自动保存当前模式的索引到对应的 ref
  useEffect(() => {
    if (mode === 'dictation') {
      dictationSentenceIndexRef.current = currentSentenceIndex
    } else {
      shadowingSentenceIndexRef.current = currentSentenceIndex
    }
  }, [currentSentenceIndex, mode])

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

          // 只有当 URL 没有 start 参数时，才恢复保存的句子索引
          // URL 参数优先级高于 localStorage
          if (startParam === null && progress.sentenceIndex !== undefined && progress.sentenceIndex > 0) {
            setCurrentSentenceIndex(progress.sentenceIndex)
            console.log('Restored sentence index from localStorage:', progress.sentenceIndex)
          } else if (startParam !== null) {
            console.log('Using start param from URL:', startParam, '(ignoring localStorage)')
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
  }, [user, authLoading, progressRestored, materialId, startParam])

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

      // 构建音频 URL（根据设备类型选择 CDN）
      const audioUrl = getCdnUrl(material.audio_path)
      setAudioSrc(audioUrl)
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

  // 处理从个人中心跳转的 start 参数，或从素材页面跳转的 id 参数
  useEffect(() => {
    if (!sampleSentences || sampleSentences.length === 0) return

    // 处理 start 参数（指定句子索引）
    if (startParam) {
      const startIndex = parseInt(startParam, 10)

      // 验证索引有效性
      if (!isNaN(startIndex) && startIndex >= 0 && startIndex < sampleSentences.length) {
        console.log(`📍 [URL Param] Setting start index from URL: ${startIndex} (total: ${sampleSentences.length} sentences)`)
        // 标记为从外部链接跳转，禁用自动播放
        shouldSkipAutoPlayRef.current = true
        setCurrentSentenceIndex(startIndex)
      } else {
        console.warn(`Invalid start index: ${startParam}, using default 0`)
      }
    }
    // 处理 materialId 参数（从素材页面跳转）
    else if (materialId) {
      console.log(`📚 [From Topics] Navigated from topics page with material: ${materialId}`)
      // 标记为从外部链接跳转，禁用自动播放
      shouldSkipAutoPlayRef.current = true
      // 索引保持为 0（从第一句开始）
    }
  }, [startParam, materialId, sampleSentences])

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

  // Auto-play when sentence index changes（但不包括从外部链接跳转）
  useEffect(() => {
    // 如果是从外部链接跳转的，不自动播放
    if (shouldSkipAutoPlayRef.current) {
      console.log('🔗 [External Link] Skipped auto-play for external link')
      shouldSkipAutoPlayRef.current = false // 重置标记
      return
    }

    if (currentSentenceIndex > 0) {
      setAutoPlayTrigger(prev => prev + 1)
      console.log('▶️ [Auto-play] Triggered for sentence index:', currentSentenceIndex)
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
        console.log(`💾 [Save] Saving sentence ${sentenceId} (${currentSentence.text?.substring(0, 30)}...) for ${audioTitle}`)

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

        console.log(`✅ [Save] Successfully saved sentence ${sentenceId}`)

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

        console.log(`✅ [Save] Practice data saved (${mode})`)

        // 保存下一句的进度（如果不是最后一句）
        if (!isLastSentence) {
          const nextIndex = currentSentenceIndex + 1
          savePracticeProgress(nextIndex)
          console.log('Saved next sentence progress:', nextIndex)
        }
      } catch (error) {
        console.error(`❌ [Save] Failed to save sentence ${sentenceId}:`, error)
        // Don't show error to user - practice continues normally
      }
    } else {
      console.warn(`⚠️ [Save] Skipped saving: user=${!!user}, currentSentence=${!!currentSentence}`)
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
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <nav className="flex items-center text-sm" aria-label="Breadcrumb">
            <Link href="/topics" className="text-gray-500 hover:text-blue-600 transition-colors">
              Topics
            </Link>
            {materialCategory && (
              <>
                <span className="mx-2 text-gray-400">›</span>
                <Link
                  href={`/topics#${materialCategory}`}
                  className="text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {materialCategory}
                </Link>
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
                // 先保存当前模式的索引
                if (mode === 'shadowing') {
                  shadowingSentenceIndexRef.current = currentSentenceIndex
                }
                // 切换到 dictation 模式，恢复 dictation 的索引
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
              Dictation
            </button>
            <button
              onClick={() => {
                // 先保存当前模式的索引
                if (mode === 'dictation') {
                  dictationSentenceIndexRef.current = currentSentenceIndex
                }
                // 切换到 shadowing 模式，恢复 shadowing 的索引
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
            <div className="flex justify-between items-center gap-2">
              {/* Navigation Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handlePrevious}
                  disabled={isFirstSentence}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {videoSrc && currentSentence && (
                  <VideoPlayer
                    key="video-player"
                    videoSrc={videoSrc}
                    currentSentence={currentSentence}
                    thumbnailPath={thumbnailPath || undefined}
                    onPlay={() => {
                      setAutoPlayTrigger(prev => prev + 1)
                    }}
                    onReplay={() => {
                      setAutoPlayTrigger(prev => prev + 1)
                    }}
                  />
                )}
                {!videoSrc && audioSrc && currentSentence && (
                  <AudioPlayer
                    key="audio-player"
                    audioSrc={audioSrc}
                    currentSentence={currentSentence}
                    playbackRate={playbackRate}
                    autoPlayTrigger={autoPlayTrigger}
                    onPlayEnd={() => {}}
                    onTimeUpdate={handleTimeUpdate}
                    onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
                    onLoadingChange={setAudioLoading}
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
              <div className="flex items-center gap-2 flex-shrink-0">
                {audioLoading && (
                  <div className="flex items-center gap-1 text-xs text-blue-600">
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>加载中...</span>
                  </div>
                )}
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-sm bg-white min-w-[60px] text-xs sm:text-sm"
                  aria-label="Speed"
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
                audioSrc={audioSrc || DEFAULT_AUDIO_SRC}
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
                <span className="text-sm text-gray-700">Auto-save practice records</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">View detailed statistics</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">Track learning progress</span>
              </li>
            </ul>

            <div className="flex gap-3 mb-4">
              <Link
                href="/register"
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
              >
                Sign Up Free
              </Link>
              <Link
                href="/login"
                className="flex-1 py-3 px-4 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                Login
              </Link>
            </div>

            <button
              onClick={() => {
                setShowSignupPrompt(false)
                localStorage.setItem('signupPromptDismissed', 'true')
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Continue practicing without signing up
            </button>
          </div>
        </div>
      )}

      {/* Debug Logger - shows on all pages during testing */}
      <DebugLogger />
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
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  )
}
