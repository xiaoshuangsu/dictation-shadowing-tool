'use client'

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { flushSync } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { titleToSlug } from '@/lib/utils/slug'
import { slugToCategory } from '@/lib/utils/category'
import { useAuth } from '@/lib/hooks/useAuth'
import { useLanguage } from '@/contexts/LanguageContext'

// Import components
import VideoPlayer from '@/components/VideoPlayer'
import AudioPlayer from '@/components/AudioPlayer'
import DictationBox from '@/components/DictationBox'
import WordMode from '@/components/WordMode'
import ShadowingPanel from '@/components/ShadowingPanel'

type PracticeMode = 'dictation' | 'shadowing'
type DictationMode = 'word' | 'whole'

interface Sentence {
  id: number
  text: string
  startTime: number | string  // 🔴 允许字符串以保留精度 (如 "9.10")
  endTime: number | string     // 🔴 允许字符串以保留精度
  translation?: string
}

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
}

const defaultSentences: Sentence[] = [
  { id: 1, text: "First snowfall.", startTime: 0.0, endTime: 1.6, translation: "第一场雪。" },
  { id: 2, text: "Today is November 26th.", startTime: 3.6, endTime: 5.6, translation: "今天是11月26日。" },
]

export default function PracticePage({ category, slug }: { category: string; slug: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language } = useLanguage()
  const { user, loading: authLoading } = useAuth()

  // Get mode from URL params, default to 'dictation'
  const modeParam = searchParams.get('mode') as PracticeMode | null
  const [mode, setMode] = useState<PracticeMode>(modeParam || 'dictation')

  // Dictation mode (word/whole sentence)
  const [dictationMode, setDictationMode] = useState<DictationMode>('word')

  // Get start index from URL
  const startIndexParam = searchParams.get('start')
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : 0

  // Material data
  const [material, setMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Audio/Video state
  const [audioSrc, setAudioSrc] = useState<string | undefined>(undefined)
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined)
  const [thumbnailPath, setThumbnailPath] = useState<string | undefined>(undefined)
  const [sampleSentences, setSampleSentences] = useState<Sentence[]>(defaultSentences)

  // CDN URL helper
  const getCdnUrl = (url: string | null): string | undefined => {
    if (!url) return undefined
    // 如果是完整 URL，直接使用
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // 相对路径：添加 R2 Worker 域名（移动端兼容）
    return `https://media.shadowhub.app/${url}`
  }

  // Practice state
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)  // 初始值为 0
  const [hasStarted, setHasStarted] = useState(false)  // 新增：跟踪是否已开始播放
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [isRevealed, setIsRevealed] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)
  const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  // Audio playback tracking
  const audioPlaybackSecondsRef = useRef(0)

  // Fetch material data
  useEffect(() => {
    async function findMaterial() {
      try {
        const { data: allMaterials } = await supabase
          .from('materials')
          .select('*')

        // Find material by title slug（添加类型断言）
        const found = allMaterials?.find((m: any) => titleToSlug(m.title) === slug) as Material | undefined

        if (found) {
          setMaterial(found)

          // Set audio/video URLs with CDN transformation
          if (found.audio_path) {
            setAudioSrc(getCdnUrl(found.audio_path))
          }
          if (found.video_path) {
            setVideoUrl(getCdnUrl(found.video_path))
          }
          if (found.thumbnail_path) {
            setThumbnailPath(getCdnUrl(found.thumbnail_path))
          }

          // Set transcript
          if (found.transcript && Array.isArray(found.transcript) && found.transcript.length > 0) {
            const transcript = found.transcript.map((s: any, index: number) => ({
              ...s,
              id: s.id ?? index,
              // 🔴 关键修复：直接使用原始值，保留精度
              // 如果 startTime 是字符串 "9.10"，不转换以避免精度丢失
              // 浏览器会自动将字符串转换为数字，并保留 "9.10" 的精度
              startTime: s.startTime,
              endTime: s.endTime,
            }))
            setSampleSentences(transcript)
          }
        } else {
          setError('Material not found')
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

  // Update mode when URL params change
  useEffect(() => {
    if (modeParam && modeParam !== mode) {
      setMode(modeParam)
    }
  }, [modeParam])

  // Handle mode toggle
  const handleModeChange = (newMode: PracticeMode) => {
    // Update URL without triggering navigation
    const url = new URL(window.location.href)
    url.searchParams.set('mode', newMode)
    window.history.replaceState({}, '', url.toString())
    setMode(newMode)

    // Reset practice state when switching modes
    setCurrentSentenceIndex(0)
    setHasStarted(false)
    setHasPlayedCurrent(false)
  }

  // Current sentence
  const currentSentence = sampleSentences[currentSentenceIndex] || sampleSentences[0]

  // Navigation
  const handlePrevious = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(prev => prev - 1)
      setAutoPlayTrigger(prev => prev + 1)
      setHasPlayedCurrent(false)
    }
  }

  const handleNext = () => {
    if (currentSentenceIndex < sampleSentences.length - 1) {
      setCurrentSentenceIndex(prev => prev + 1)
      setAutoPlayTrigger(prev => prev + 1)
      setHasPlayedCurrent(false)
    }
  }

  const handlePlayOrNext = () => {
    console.log("=== handlePlayOrNext Called ===")
    console.log("Button Clicked, current index:", currentSentenceIndex)
    console.log("hasStarted:", hasStarted)
    console.log("sampleSentences.length:", sampleSentences.length)

    // 场景 A：第一次点击，播放当前第一句
    if (!hasStarted) {
      console.log("场景 A: 第一次点击，播放当前句 (index 0)")
      flushSync(() => {
        setHasStarted(true)
        setAutoPlayTrigger(prev => prev + 1)
      })
      console.log("设置 hasStarted = true, 触发播放 index 0")
      return
    }

    // 场景 B：后续点击，先递增索引，再播放
    if (currentSentenceIndex < sampleSentences.length - 1) {
      console.log("场景 B: 切换到下一句")
      console.log("当前索引:", currentSentenceIndex, "< 总数:", sampleSentences.length - 1)

      // 使用 flushSync 强制同步更新，确保索引先更新，再触发播放
      flushSync(() => {
        setCurrentSentenceIndex(prev => {
          const newIndex = prev + 1
          console.log("更新索引:", prev, "->", newIndex)
          return newIndex
        })
      })

      // 索引更新后，再触发播放
      console.log("索引已更新，现在触发播放")
      console.log("更新后的 currentSentenceIndex:", currentSentenceIndex)
      setAutoPlayTrigger(prev => prev + 1)
      console.log("触发播放新索引")
    } else {
      console.log("场景 C: 已是最后一句，重播")
      // 已是最后一句，重播
      setAutoPlayTrigger(prev => prev + 1)
    }
    console.log("=== handlePlayOrNext End ===")
  }

  // Reset state when sentence changes
  useLayoutEffect(() => {
    console.log("=== useLayoutEffect: currentSentenceIndex changed ===")
    console.log("New index:", currentSentenceIndex)
    console.log("Current sentence:", sampleSentences[currentSentenceIndex]?.text)
    setIsRevealed(false)
    // Don't reset hasPlayedCurrent here - it's controlled by user clicks
  }, [currentSentenceIndex])

  // Dictation completion handlers
  const handleDictationComplete = (isCorrect: boolean, usedShowWords?: boolean, duration?: number) => {
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
    // Don't auto-advance - let user click Next button
  }

  const handleWordModeComplete = (isCorrect: boolean, usedShowWords?: boolean, durationSeconds?: number) => {
    handleDictationComplete(isCorrect, usedShowWords, durationSeconds)
  }

  const handleShadowingComplete = (isCorrect: boolean, durationSeconds: number) => {
    handleDictationComplete(isCorrect, false, durationSeconds)
  }

  // Audio handlers
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time)
  }

  const handlePlaybackTimeUpdate = (totalSeconds: number) => {
    audioPlaybackSecondsRef.current = totalSeconds
  }

  // Calculate stats
  const totalPractices = completedSentences.size
  const accuracy = totalPractices > 0 ? Math.round((correctCount / totalPractices) * 100) : 0

  // Show loading state
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

  // Show error state
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Three Level Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
          {/* Level 1: Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-sm">
            <Link href="/topics" className="text-blue-600 hover:text-blue-700">
              Topics
            </Link>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-600">{slugToCategory(category)}</span>
          </div>

          {/* Level 2: Material Title */}
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{material.title}</h1>
          </div>

          {/* Level 3: Mode Toggle Tabs (Centered) */}
          <div className="flex justify-center">
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

      {/* Main Content - Three Column Layout */}
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Video Player (25%) */}
          <div className="lg:col-span-1 w-full">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-40">
              {/* Progress Indicator - Moved Here */}
              <div className="text-center mb-3 pb-3 border-b border-gray-200">
                <div className="text-xs text-gray-900">
                  {currentSentenceIndex + 1} <span className="text-gray-400">/</span> {sampleSentences.length}
                </div>
              </div>

              {videoUrl ? (
                <VideoPlayer
                  videoSrc={videoUrl}
                  currentSentence={currentSentence}
                  currentTime={currentTime}
                  thumbnailPath={thumbnailPath}
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A9 9 0 0121 2.012 9 9 0 0118.455 5.788z" />
                    </svg>
                    <p className="text-gray-500">No video available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column - Practice Area (50%) */}
          <div className="lg:col-span-[2] w-full bg-white rounded-lg shadow-sm p-6">
            {/* Hidden Audio Player - The Only Media Source */}
            {audioSrc && currentSentence && (mode === 'dictation' || mode === 'shadowing') && (
              <div style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', pointerEvents: 'none' }}>
                <AudioPlayer
                  audioSrc={audioSrc}
                  currentSentence={currentSentence}
                  playbackRate={playbackRate}
                  autoPlayTrigger={autoPlayTrigger}
                  onPlayEnd={() => {}}
                  onTimeUpdate={handleTimeUpdate}
                  onPlaybackTimeUpdate={handlePlaybackTimeUpdate}
                />
              </div>
            )}

            {/* Playback Controls */}
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

            {/* Practice Area */}
            <div className="min-h-[400px]">
              {mode === 'dictation' ? (
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
                  />
                ) : (
                  <DictationBox
                    sentence={currentSentence}
                    onNext={handleNext}
                    onComplete={handleDictationComplete}
                    dictationMode={dictationMode}
                  />
                )
              ) : audioSrc ? (
                <ShadowingPanel
                  sentence={currentSentence}
                  audioSrc={audioSrc}
                  onNext={handleNext}
                  onComplete={handleShadowingComplete}
                  isLastSentence={isLastSentence}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  No audio available
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div>Completed: {totalPractices}/{sampleSentences.length}</div>
              <div>Accuracy: {accuracy}%</div>
            </div>
          </div>

          {/* Right Column - Transcript (25%) */}
          <div className="lg:col-span-1 w-full">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Transcript</h3>
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showTranscript ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {sampleSentences.map((sentence, index) => {
                  // Convert text to asterisks when hidden
                  const displayText = showTranscript
                    ? sentence.text
                    : sentence.text.split(/\s+/).map(() => '***').join(' ')

                  return (
                    <div
                      key={sentence.id}
                      onClick={() => {
                        // 切换到选中的句子并触发播放
                        setCurrentSentenceIndex(index)
                        setAutoPlayTrigger(prev => prev + 1)
                      }}
                      className={`p-3 rounded cursor-pointer transition-colors ${
                        index === currentSentenceIndex
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : index < currentSentenceIndex
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-sm font-semibold ${
                          index < currentSentenceIndex
                            ? 'bg-green-500 text-white'
                            : index === currentSentenceIndex
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-300 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 leading-relaxed">
                            {displayText}
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
      </div>
    </div>
  )
}
