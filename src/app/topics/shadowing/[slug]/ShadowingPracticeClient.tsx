'use client'

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import AudioPlayer from "@/components/AudioPlayer"
import DictationBox from "@/components/DictationBox"
import ShadowingPanel from "@/components/ShadowingPanel"
import WordMode from "@/components/WordMode"
import { useAuth } from "@/lib/hooks/useAuth"
import { savePracticeRecord } from "@/lib/supabase/client"
import { onDictationComplete, onShadowingComplete } from "@/lib/supabase/streak"

const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

// Category mapping for English labels
const CATEGORY_LABELS: Record<string, string> = {
  '日常生活': 'Daily Life',
  '历史演讲': 'Historical Speeches',
  '文化历史': 'Culture & History',
  '艺术文化': 'Arts & Culture',
}

const getCategoryLabel = (category: string) => {
  return CATEGORY_LABELS[category] || category
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

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [audioTitle, setAudioTitle] = useState<string | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [sampleSentences, setSampleSentences] = useState<Sentence[] | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [materialError, setMaterialError] = useState<string | null>(null)
  const [materialCategory, setMaterialCategory] = useState<string | null>(null)

  const [mode, setMode] = useState<PracticeMode>("shadowing")
  const [dictationMode, setDictationMode] = useState<DictationMode>("word")
  const [isDictationModeOpen, setIsDictationModeOpen] = useState(false)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(new Set())
  const [correctSentences, setCorrectSentences] = useState<Set<number>>(new Set())
  const [incorrectSentences, setIncorrectSentences] = useState<Set<number>>(new Set())
  const [correctCount, setCorrectCount] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)

  const audioPlaybackSecondsRef = useRef(0)

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

        const material = materials?.find(m => titleToSlug(m.title) === slug)

        if (material) {
          setMaterialId(material.id)
          setAudioTitle(material.title)
          // Build full audio URL from Supabase Storage
          const supabaseAudioUrl = `https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${material.audio_path}`
          setAudioSrc(supabaseAudioUrl)
          setMaterialCategory(material.category)

          // Use transcript from material (like the original practice page)
          if (material.transcript && Array.isArray(material.transcript) && material.transcript.length > 0) {
            console.log(`Loaded transcript with ${material.transcript.length} sentences`)
            setSampleSentences(material.transcript)
          } else {
            setSampleSentences(defaultSentences)
          }
        } else {
          setMaterialError('Material not found')
          setAudioTitle(DEFAULT_AUDIO_TITLE)
          setAudioSrc(DEFAULT_AUDIO_SRC)
          setSampleSentences(defaultSentences)
        }
      } catch (error) {
        console.error('Error loading material:', error)
        setMaterialError('Failed to load material')
        setAudioTitle(DEFAULT_AUDIO_TITLE)
        setAudioSrc(DEFAULT_AUDIO_SRC)
        setSampleSentences(defaultSentences)
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

    if (sampleSentences && currentSentenceIndex < sampleSentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1)
    }
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
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!currentSentence || !sampleSentences) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{materialError || 'Failed to load content'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <nav className="flex items-center text-sm">
            <Link href="/topics" className="text-gray-500 hover:text-blue-600">Topics</Link>
            {materialCategory && (
              <>
                <span className="mx-2 text-gray-400">›</span>
                <Link href={`/topics#${materialCategory}`} className="text-gray-500 hover:text-blue-600">{getCategoryLabel(materialCategory)}</Link>
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
        {mode === "dictation" && (
          <div className="flex justify-start mb-4 items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Dictation mode:</span>
            <div className="relative min-w-[200px]">
              {/* 触发按钮 */}
              <button
                type="button"
                onClick={() => setIsDictationModeOpen(!isDictationModeOpen)}
                className="w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors flex items-center justify-between"
              >
                <span className="whitespace-nowrap">
                  {dictationMode === 'word' ? 'Word' : 'Whole Caption'}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isDictationModeOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {isDictationModeOpen && (
                <div className="absolute z-[100] w-full min-w-[200px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setDictationMode('word')
                      setCurrentSentenceIndex(0)
                      setCompletedSentences(new Set())
                      setCorrectSentences(new Set())
                      setIncorrectSentences(new Set())
                      setCorrectCount(0)
                      setIsRevealed(false)
                      setIsDictationModeOpen(false)
                    }}
                    className={`w-full px-4 py-2.5 text-sm text-left transition-colors whitespace-nowrap ${
                      dictationMode === 'word'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-blue-50'
                    }`}
                  >
                    Word
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDictationMode('whole')
                      setCurrentSentenceIndex(0)
                      setCompletedSentences(new Set())
                      setCorrectSentences(new Set())
                      setIncorrectSentences(new Set())
                      setCorrectCount(0)
                      setIsRevealed(false)
                      setIsDictationModeOpen(false)
                    }}
                    className={`w-full px-4 py-2.5 text-sm text-left transition-colors whitespace-nowrap ${
                      dictationMode === 'whole'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 hover:bg-blue-50'
                    }`}
                  >
                    Whole Caption
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="text-center mb-4 text-sm text-gray-600">
            {currentSentenceIndex + 1} / {sampleSentences.length}
          </div>

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
                  <option value="2">2x</option>
                </select>
              </div>
            </div>
          </div>

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

        {/* Show Transcript Button */}
        <div className="text-center">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </button>
        </div>

        {showTranscript && (
          <div className="mt-4 bg-white rounded-lg shadow-sm p-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Transcript</h3>
            <div className="space-y-3">
              {sampleSentences.map((sentence, index) => {
                const isCompleted = completedSentences.has(index)
                const isCorrect = correctSentences.has(index)
                const isIncorrect = incorrectSentences.has(index)
                const isCurrent = index === currentSentenceIndex

                return (
                  <div
                    key={sentence.id}
                    onClick={() => handleSentenceClick(index)}
                    className={`border rounded-lg p-3 relative cursor-pointer hover:bg-blue-100 transition-colors ${
                      isCurrent
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

                      {/* Sentence Content */}
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">
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
                        {sentence.translation && (
                          <p className="text-xs text-gray-600 italic mt-1">
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
        )}
      </div>
    </main>
  )
}

export default function ShadowingPracticeClient({ slug }: { slug: string }) {
  return <ShadowingPracticeClientContent slug={slug} />
}
