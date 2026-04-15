'use client'

import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, savePracticeRecord } from '@/lib/supabase/client'
import { onDictationComplete, onShadowingComplete } from '@/lib/supabase/streak'
import { titleToSlug } from '@/lib/utils/slug'
import { slugToCategory, getCategoryMetadataBySlug } from '@/lib/utils/category'
import { useAuth } from '@/lib/hooks/useAuth'
import logger from '@/lib/utils/logger'
import type { Sentence } from '@/types'

// Import components
import VideoPlayer from '@/components/VideoPlayer'
import YouTubePlayer from '@/components/YouTubePlayer'
import AudioPlayer from '@/components/AudioPlayer'
import DictationBox from '@/components/DictationBox'
import WordMode from '@/components/WordMode'
import ShadowingPanel from '@/components/ShadowingPanel'
import { TranslationLanguageSelector, type TranslationLanguage } from '@/components/TranslationLanguageSelector'
import { getStoredLanguage } from '@/components/TranslationLanguageSelector'
import ClickableTranscript from '@/components/ClickableTranscript'
import PremiumBlocker from '@/components/PremiumBlocker'
import DebugErrorBoundary from '@/components/DebugErrorBoundary'

type PracticeMode = 'dictation' | 'shadowing'
type DictationMode = 'word' | 'whole'

interface Material {
  id: string
  title: string
  category: string
  difficulty: 'A1' | 'A2' | 'B1' | 'B2'
  audio_path: string
  video_path?: string | null
  thumbnail_path: string | null
  transcript: any[]
  duration?: number | null
  source_type?: 'r2' | 'youtube'
  youtube_id?: string | null
  is_premium?: boolean
}

const defaultSentences: Sentence[] = [
  { id: 1, text: "First snowfall.", startTime: 0.0, endTime: 1.6, translation: { zh: "第一场雪。" } },
  { id: 2, text: "Today is November 26th.", startTime: 3.6, endTime: 5.6, translation: { zh: "今天是11月26日。" } },
]

export default function PracticePage({ category, slug }: { category: string; slug: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [returnPageParam, setReturnPageParam] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storageKey = `category_${category}_page`
      const savedPage = sessionStorage.getItem(storageKey)

      if (savedPage && Number(savedPage) > 1) {
        setReturnPageParam(`?page=${savedPage}`)
      }
    } catch (e) {
      console.error('Failed to get return page:', e)
    }
  }, [category])

  const modeParam = searchParams.get('mode') as PracticeMode | null
  const [mode, setMode] = useState<PracticeMode>(modeParam || 'dictation')

  const [dictationMode, setDictationMode] = useState<DictationMode>('word')

  const startIndexParam = searchParams.get('start')
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : 0

  const timestampParam = searchParams.get('t')

  const [material, setMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sampleSentences, setSampleSentences] = useState<Sentence[]>(defaultSentences)

  const [dictationIndex, setDictationIndex] = useState(0)
  const [shadowingIndex, setShadowingIndex] = useState(0)

  // 🔥 getCdnUrl 仅处理 R2 资源，不做 YouTube 检测（由 source_type 分流）
  const getCdnUrl = useCallback((url: string | null): string | undefined => {
    if (!url) return undefined

    // 已是完整 URL（包括 YouTube 缩略图），直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('/videos/') && !url.endsWith('.mp4')) {
        return `${url}.mp4`
      }
      return url
    }

    // R2 资源：添加 CDN 前缀
    const workerUrl = 'https://media.shadowhub.app'
    let finalUrl = `${workerUrl}/${url}`

    if (url.includes('video') && !url.endsWith('.mp4')) {
      finalUrl = `${finalUrl}.mp4`
    }

    if (url.includes('audio') && !url.endsWith('.mp3') && !url.endsWith('.m4a')) {
      finalUrl = `${finalUrl}.mp3`
    }

    return finalUrl
  }, [])

  const playerInfo = useMemo(() => {
    if (!material) return null

    const sourceType = material.source_type || 'r2'

    if (sourceType === 'youtube' && material.youtube_id) {
      return {
        type: 'youtube' as const,
        audioSrc: undefined,
        videoUrl: undefined,
        thumbnailPath: getCdnUrl(material.thumbnail_path)
      }
    } else {
      return {
        type: 'r2' as const,
        audioSrc: getCdnUrl(material.audio_path),
        videoUrl: material.video_path ? getCdnUrl(material.video_path) : undefined,
        thumbnailPath: getCdnUrl(material.thumbnail_path)
      }
    }
  }, [material, getCdnUrl])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const handleAudioReady = (audioElement: HTMLAudioElement) => {
    audioRef.current = audioElement
  }

  const [hasStarted, setHasStarted] = useState(false)
  const [videoDegraded, setVideoDegraded] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [highlightSentenceIndex, setHighlightSentenceIndex] = useState<number | null>(null)
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [isRevealed, setIsRevealed] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguage>(getStoredLanguage())
  const [showTranslation, setShowTranslation] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)
  const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  const audioPlaybackSecondsRef = useRef(0)

  const DEVELOPER_WHITELIST = [
    'suxiaoshuang@3dpea.com',
  ]

  const isPro = useMemo(() => {
    if (!user) return false

    if (user.email && DEVELOPER_WHITELIST.includes(user.email)) {
      return true
    }

    return false
  }, [user])

  const isBlocked = material?.is_premium && !isPro

  const practiceAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    if (!loading && material && sampleSentences.length > 0) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [loading, material, sampleSentences.length])

  useEffect(() => {
    async function findMaterial() {
      try {
        const { data: found, error } = await supabase
          .from('materials')
          .select('*')
          .eq('slug', slug)
          .single()

        if (error) {
          console.error('Database query error:', error)
          setError('Failed to load material')
          return
        }

        if (!found) {
          setError('Material not found')
          return
        }

        setMaterial(found)

        let transcriptData = found.transcript
        if (typeof transcriptData === 'string') {
          try {
            transcriptData = JSON.parse(transcriptData)
          } catch (e) {
            console.error('Failed to parse transcript JSON:', e)
            transcriptData = null
          }
        }

        if (transcriptData && Array.isArray(transcriptData) && transcriptData.length > 0) {
          const transcript = transcriptData
            .map((s: any, index: number) => {
              // 安全处理 translation 字段
              let safeTranslation = undefined

              if (s.translation) {
                if (typeof s.translation === 'object' && s.translation !== null) {
                  safeTranslation = s.translation
                } else if (typeof s.translation === 'string') {
                  // 如果是字符串，记录警告并设置为 undefined
                  console.warn(`[PracticePage] Sentence ${index} translation is string, expected object:`, s.translation)
                  safeTranslation = undefined
                }
              }

              const sentenceData = {
                ...s,
                id: s.id ?? index,
                startTime: s.startTime,
                endTime: s.endTime,
                translation: safeTranslation
              }

              // 调试日志：记录每个句子的数据结构
              if (process.env.NODE_ENV === 'development' && index < 3) {
                console.log(`[PracticePage] Sentence ${index} data structure:`, {
                  hasText: !!s.text,
                  translationType: typeof s.translation,
                  translationKeys: s.translation && typeof s.translation === 'object' ? Object.keys(s.translation) : 'N/A',
                  finalTranslation: safeTranslation
                })
              }

              return sentenceData
            })
            // 🔴 关键修复：过滤掉没有 text 字段的无效句子
            .filter((s: any) => s.text && s.text.trim().length > 0)

          console.log(`[PracticePage] 有效句子数: ${transcript.length} / ${transcriptData.length}`)

          setSampleSentences(transcript)
        }
      } catch (err) {
        console.error('Error loading material:', err)
        setError('Failed to load material')
      } finally {
        setLoading(false)
      }
    }

    findMaterial()
  }, [slug])

  useEffect(() => {
    if (modeParam && modeParam !== mode) {
      setMode(modeParam)
    }
  }, [modeParam])

  useEffect(() => {
    if (startIndex > 0) {
      if (mode === 'dictation') {
        setDictationIndex(startIndex)
      } else if (mode === 'shadowing') {
        setShadowingIndex(startIndex)
      }
    }
  }, [startIndex, mode])

  useEffect(() => {
    if (!timestampParam || sampleSentences.length === 0) return

    const timestamp = parseFloat(timestampParam)
    if (isNaN(timestamp)) return

    const targetIndex = sampleSentences.findIndex(sentence => {
      const startTime = typeof sentence.startTime === 'string' ? parseFloat(sentence.startTime) : sentence.startTime
      const endTime = typeof sentence.endTime === 'string' ? parseFloat(sentence.endTime) : sentence.endTime
      return timestamp >= startTime && timestamp <= endTime
    })

    if (targetIndex !== -1) {
      if (mode === 'dictation') {
        setDictationIndex(targetIndex)
      } else if (mode === 'shadowing') {
        setShadowingIndex(targetIndex)
      }

      setHasStarted(true)
      setAutoPlayTrigger(prev => prev + 1)

      setHighlightSentenceIndex(targetIndex)
      setTimeout(() => {
        setHighlightSentenceIndex(null)
      }, 3000)

      const url = new URL(window.location.href)
      url.searchParams.delete('t')
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [timestampParam, sampleSentences, mode, router])

  const showToast = (message: string, duration = 3000) => {
    setToastMessage(message)
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, duration)
  }

  useEffect(() => {
    const handleVideoDegraded = (event: Event) => {
      setVideoDegraded(true)
      showToast('检测到网络较慢，已自动为您隐藏视频并切换至纯音频学习模式')
    }

    window.addEventListener('videoDegraded', handleVideoDegraded)

    return () => {
      window.removeEventListener('videoDegraded', handleVideoDegraded)
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  const handleModeChange = (newMode: PracticeMode) => {
    const url = new URL(window.location.href)
    url.searchParams.set('mode', newMode)
    window.history.replaceState({}, '', url.toString())
    setMode(newMode)

    setHasStarted(false)
    setHasPlayedCurrent(false)
  }

  const currentSentenceIndex = mode === 'dictation' ? dictationIndex : shadowingIndex
  const currentSentence = sampleSentences[currentSentenceIndex] || sampleSentences[0]
  const nextSentence = sampleSentences[currentSentenceIndex + 1] || null  // 🔴 获取下一句（用于时间戳重叠保护）

  const handlePrevious = () => {
    const currentIndex = mode === 'dictation' ? dictationIndex : shadowingIndex
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      if (mode === 'dictation') {
        setDictationIndex(newIndex)
      } else {
        setShadowingIndex(newIndex)
      }
      setAutoPlayTrigger(prev => prev + 1)
      setHasPlayedCurrent(false)
    }
  }

  const isSkippableSentence = (sentence: Sentence) => {
    return !sentence.blanks || !Array.isArray(sentence.blanks) || sentence.blanks.length === 0
  }

  const handleAutoSkipSentence = async (sentence: Sentence, index: number) => {
    const newCompleted = new Set(completedSentences)
    newCompleted.add(index)
    setCompletedSentences(newCompleted)
    setCorrectCount(correctCount + 1)
    const newCorrectSet = new Set(correctSentences)
    newCorrectSet.add(index)
    setCorrectSentences(newCorrectSet)

    if (user && material) {
      try {
        await savePracticeRecord({
          userId: user.id,
          sentenceId: sentence.id,
          sentenceText: sentence.text,
          practiceMode: mode,
          dictationMode: mode === 'dictation' ? dictationMode : undefined,
          isCorrect: true,
          usedShowWords: false,
          audioTitle: material.title,
          materialId: material.id,
          durationSeconds: 0
        })
      } catch (error) {
        console.error('AutoSkip: Failed to save record:', error)
      }
    }
  }

  const handleNext = async () => {
    const currentIndex = mode === 'dictation' ? dictationIndex : shadowingIndex
    const currentSentence = sampleSentences[currentIndex]

    if (currentSentence && isSkippableSentence(currentSentence)) {
      await handleAutoSkipSentence(currentSentence, currentIndex)
    }

    if (currentIndex < sampleSentences.length - 1) {
      const newIndex = currentIndex + 1
      if (mode === 'dictation') {
        setDictationIndex(newIndex)
      } else {
        setShadowingIndex(newIndex)
      }
      setAutoPlayTrigger(prev => prev + 1)
      setHasPlayedCurrent(false)
    }
  }

  const handlePlayOrNext = () => {
    if (audioRef.current && audioRef.current.readyState > 0) {
      // Audio already ready
    } else if (audioRef.current) {
      const audio = audioRef.current

      const originalTime = audio.currentTime
      const originalVolume = audio.volume

      audio.volume = 0
      audio.play().then(() => {
        audio.pause()
        audio.currentTime = originalTime
        audio.volume = originalVolume
      }).catch(err => {
        audio.currentTime = originalTime
        audio.volume = originalVolume
      })
    }

    if (!hasStarted) {
      const isMobile = window.innerWidth < 1024
      if (isMobile) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      requestAnimationFrame(() => {
        setHasStarted(true)
        setAutoPlayTrigger(prev => prev + 1)
      })
      return
    }

    const currentIndex = mode === 'dictation' ? dictationIndex : shadowingIndex
    if (currentIndex < sampleSentences.length - 1) {
      requestAnimationFrame(() => {
        const newIndex = currentIndex + 1
        if (mode === 'dictation') {
          setDictationIndex(newIndex)
        } else {
          setShadowingIndex(newIndex)
        }
        setAutoPlayTrigger(prev => prev + 1)
      })
    } else {
      setAutoPlayTrigger(prev => prev + 1)
    }
  }

  useLayoutEffect(() => {
    setIsRevealed(false)
  }, [currentSentenceIndex])

  useLayoutEffect(() => {
    if (!hasStarted) return

    const isMobile = window.innerWidth < 1024
    if (!isMobile) {
      return
    }

    const timer = setTimeout(() => {
      if (practiceAreaRef.current) {
        const headerHeight = 120
        const elementTop = practiceAreaRef.current.getBoundingClientRect().top
        const scrollTop = window.pageYOffset + elementTop - headerHeight

        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [currentSentenceIndex, hasStarted])

  const handleDictationComplete = async (isCorrect: boolean, usedShowWords?: boolean, duration?: number) => {
    const newCompleted = new Set(completedSentences)
    newCompleted.add(currentSentenceIndex)
    setCompletedSentences(newCompleted)

    if (isCorrect) {
      setCorrectCount(correctCount + 1)
      const newCorrectSet = new Set(correctSentences)
      newCorrectSet.add(currentSentenceIndex)
      setCorrectSentences(newCorrectSet)
    }

    setIsRevealed(false)

    if (user && material && currentSentence) {
      try {
        await savePracticeRecord({
          userId: user.id,
          sentenceId: currentSentence.id,
          sentenceText: currentSentence.text,
          practiceMode: mode,
          dictationMode: mode === 'dictation' ? dictationMode : undefined,
          isCorrect,
          usedShowWords,
          audioTitle: material.title,
          materialId: material.id,
          durationSeconds: duration
        })

        if (mode === 'dictation') {
          const seconds = duration || 0
          const minutes = seconds / 60
          await onDictationComplete(user.id, minutes)
        } else if (mode === 'shadowing') {
          const seconds = duration || 0
          const minutes = seconds / 60
          await onShadowingComplete(user.id, minutes)
        }
      } catch (error) {
        console.error('Failed to save practice record:', error)
      }
    }
  }

  const handleWordModeComplete = (isCorrect: boolean, usedShowWords?: boolean, durationSeconds?: number) => {
    handleDictationComplete(isCorrect, usedShowWords, durationSeconds)
  }

  const handleShadowingComplete = (isCorrect: boolean, durationSeconds: number) => {
    handleDictationComplete(isCorrect, false, durationSeconds)
  }

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time)
  }

  const handlePlaybackTimeUpdate = (totalSeconds: number) => {
    audioPlaybackSecondsRef.current = totalSeconds
  }

  const totalPractices = completedSentences.size
  const accuracy = totalPractices > 0 ? Math.round((correctCount / totalPractices) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Material Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/topics"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ← Back to Topics
          </Link>
        </div>
      </div>
    )
  }

  if (!material || !currentSentence) return null

  const isLastSentence = currentSentenceIndex === sampleSentences.length - 1
  const isFirstSentence = currentSentenceIndex === 0

  const getEndBuffer = (): number => {
    if (material?.category === 'IELTS Listening') {
      return 0.05
    }
    return -0.2
  }

  const endBuffer = getEndBuffer()

  return (
    <DebugErrorBoundary>
      <div className="min-h-screen bg-gray-50">
      {toastMessage && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50"></div>

          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white px-6 py-4 rounded-lg shadow-xl max-w-sm mx-auto text-center">
            <div className="flex items-center justify-center gap-2 text-gray-800">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{toastMessage}</span>
            </div>
          </div>
        </>
      )}

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/topics" className="text-blue-600 hover:text-blue-700">
              Topics
            </Link>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link
              href={`/topics/${category}${returnPageParam}`}
              className="text-blue-600 hover:text-blue-700"
            >
              {getCategoryMetadataBySlug(category)?.name || slugToCategory(category)}
            </Link>
          </div>

          <div className={`${hasStarted ? 'max-lg:py-2' : ''} text-center transition-all duration-300`}>
            <h1 className={`${hasStarted ? 'max-lg:text-lg max-lg:font-semibold' : 'text-2xl md:text-3xl'} font-bold text-gray-900`}>
              {material.title}
            </h1>
          </div>

          <div id="mode-toggle-tabs" className="flex justify-center">
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleModeChange('dictation')}
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  mode === 'dictation'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dictation
              </button>
              <button
                onClick={() => handleModeChange('shadowing')}
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  mode === 'shadowing'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Shadowing
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${hasStarted ? 'max-lg:hidden' : ''} lg:col-span-1 w-full transition-all duration-300`}>
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-40">
              {playerInfo && (() => {
                const isVideoMaterial = playerInfo.type === 'youtube' || playerInfo.videoUrl
                return (
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900">
                      {isVideoMaterial ? 'Video' : 'Audio'}
                    </h3>
                  </div>
                )
              })()}

              {playerInfo && (() => {
                if (playerInfo.type === 'youtube' && material.youtube_id && !videoDegraded) {
                  return (
                    <YouTubePlayer
                      youtubeId={material.youtube_id}
                      currentSentence={currentSentence}
                      playbackRate={playbackRate}
                      autoPlayTrigger={autoPlayTrigger}
                      onPlayEnd={() => {}}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadingChange={() => {}}
                      practiceMode={hasStarted && autoPlayTrigger > 0}
                      nextSentence={nextSentence}  // 🔴 传递下一句用于时间戳重叠保护
                    />
                  )
                }

                if (playerInfo.videoUrl && !videoDegraded) {
                  return (
                    <VideoPlayer
                      videoSrc={playerInfo.videoUrl}
                      currentSentence={currentSentence}
                      currentTime={currentTime}
                      thumbnailPath={playerInfo.thumbnailPath}
                      onDegraded={() => setVideoDegraded(true)}
                    />
                  )
                }

                if (playerInfo.thumbnailPath) {
                  return (
                    <div
                      className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer group"
                      onClick={() => {
                        // 🔥 优化时序：先设置状态，给 React 渲染窗口
                        setHasStarted(true)
                        // 🔥 延迟触发播放，确保 IFrame 已渲染
                        setTimeout(() => {
                          setAutoPlayTrigger(prev => prev + 1)
                        }, 50)
                      }}
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundImage: `url(${playerInfo.thumbnailPath})` }}
                      >
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-center transform transition-transform duration-300 group-hover:scale-110">
                          <div className="w-16 h-16 mx-auto mb-2 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                          <p className="text-sm font-medium">点击开始练习</p>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
                    <p className="text-gray-400 text-sm">No cover image</p>
                  </div>
                )
              })()}
            </div>
          </div>

          <div
            ref={practiceAreaRef}
            className={`lg:col-span-[2] w-full bg-white rounded-lg shadow-sm p-6 transition-all duration-300`}
          >
            {playerInfo && (() => {
              const isR2Material = playerInfo.type === 'r2'

              if (!isR2Material || !playerInfo.audioSrc || !currentSentence) {
                return null
              }

              if (mode !== 'dictation' && mode !== 'shadowing') {
                return null
              }

              return (
                <div style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', pointerEvents: 'none' }}>
                  <AudioPlayer
                    audioSrc={playerInfo.audioSrc}
                    currentSentence={currentSentence}
                    playbackRate={playbackRate}
                    autoPlayTrigger={autoPlayTrigger}
                    onPlayEnd={() => {}}
                    onTimeUpdate={handleTimeUpdate}
                    onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
                    onReady={handleAudioReady}
                    endBuffer={endBuffer}
                  />
                </div>
              )
            })()}

            {isBlocked ? (
              <PremiumBlocker materialTitle={material.title} />
            ) : (
              <>
                <div className="text-center mb-3">
                  <div className="text-xs text-gray-900">
                    {currentSentenceIndex + 1} <span className="text-gray-400">/</span> {sampleSentences.length}
                  </div>
                </div>

                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-2">
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
                        <option value="2">2x</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="min-h-[400px]">
              {isBlocked ? (
                <PremiumBlocker materialTitle={material.title} />
              ) : (
                mode === 'dictation' ? (
                  dictationMode === 'word' ? (
                    <WordMode
                      sentence={currentSentence}
                      currentIndex={currentSentenceIndex}
                      totalSentences={sampleSentences.length}
                      isLastSentence={isLastSentence}
                      onNext={handleNext}
                      onComplete={handleWordModeComplete}
                      dictationMode={dictationMode}
                      onDictationModeChange={setDictationMode}
                      translationLanguage={translationLanguage}
                      showTranslation={showTranslation}
                      onTranslationLanguageChange={(lang, show) => {
                        setTranslationLanguage(lang)
                        setShowTranslation(show)
                      }}
                    />
                  ) : (
                    <DictationBox
                      sentence={currentSentence}
                      onNext={handleNext}
                      onComplete={handleDictationComplete}
                      dictationMode={dictationMode}
                      onDictationModeChange={setDictationMode}
                      translationLanguage={translationLanguage}
                      showTranslation={showTranslation}
                      onTranslationLanguageChange={(lang, show) => {
                        setTranslationLanguage(lang)
                        setShowTranslation(show)
                      }}
                    />
                  )
                ) : (playerInfo && (() => {
                  const isR2Material = playerInfo.type === 'r2'

                  if (isR2Material && !playerInfo.audioSrc) {
                    return (
                      <div className="flex items-center justify-center h-64 text-gray-500">
                        No audio available
                      </div>
                    )
                  }

                  return (
                    <ShadowingPanel
                      sentence={currentSentence}
                      audioSrc={isR2Material ? playerInfo.audioSrc : undefined}
                      onNext={handleNext}
                      onComplete={handleShadowingComplete}
                      isLastSentence={isLastSentence}
                      translationLanguage={translationLanguage}
                      showTranslation={showTranslation}
                      onTranslationLanguageChange={(lang, show) => {
                        setTranslationLanguage(lang)
                        setShowTranslation(show)
                      }}
                    />
                  )
                })())
                )}
              </div>
            </>
            )}

            {!isBlocked && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div>Completed: {totalPractices}/{sampleSentences.length}</div>
                <div>Accuracy: {accuracy}%</div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 w-full">
            <ClickableTranscript
              sentences={sampleSentences}
              currentIndex={currentSentenceIndex}
              highlightIndex={highlightSentenceIndex}
              onSelectSentence={(index) => {
                if (isBlocked) {
                  showToast('🔒 Premium Feature: Unlock PRO to practice with transcripts')
                  const modeToggleTabs = document.getElementById('mode-toggle-tabs')
                  if (modeToggleTabs) {
                    modeToggleTabs.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                  return
                }

                if (mode === 'dictation') {
                  setDictationIndex(index)
                } else {
                  setShadowingIndex(index)
                }
                setAutoPlayTrigger(prev => prev + 1)
              }}
              showTranscript={showTranscript}
              onToggleTranscript={() => setShowTranscript(!showTranscript)}
              translationLanguage={translationLanguage}
              materialId={material.id}
              materialTitle={material.title}
              audioSrc={playerInfo?.audioSrc}
              hasStarted={hasStarted}
              isBlocked={isBlocked}
            />
          </div>
        </div>
      </div>
    </div>
    </DebugErrorBoundary>
  )
}
