"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string
}

export default function TimestampMarker() {
  const [materialId, setMaterialId] = useState<string>("")
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [audioSrc, setAudioSrc] = useState<string>("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [saveStatus, setSaveStatus] = useState("")
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0)

  // Load material
  const loadMaterial = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('title', materialId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Material not found')

      setSentences(data.transcript || [])
      setAudioSrc(`https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/${data.audio_path}`)
      setCurrentIndex(0)
    } catch (error: any) {
      console.error('Error loading material:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Get the sentence that should be playing at current time
  const getActiveSentenceIndex = (time: number): number => {
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i]
      // If this is the last sentence, use its endTime as upper bound
      if (i === sentences.length - 1) {
        if (time >= s.startTime) return i
      } else {
        // For non-last sentences, check if time is within [startTime, endTime)
        if (time >= s.startTime && time < s.endTime) return i
      }
    }
    return sentences.length - 1
  }

  // Mark current time as end time for current sentence
  const markEndTime = () => {
    if (!audioRef.current) return

    const endTime = audioRef.current.currentTime
    const newSentences = [...sentences]

    // Update current sentence's end time
    newSentences[currentIndex].endTime = endTime

    // Set next sentence's start time
    if (currentIndex < sentences.length - 1) {
      newSentences[currentIndex + 1].startTime = endTime
    }

    setSentences(newSentences)

    // Auto-advance to next sentence
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  // Update sentence text
  const updateSentenceText = (index: number, newText: string) => {
    const newSentences = [...sentences]
    newSentences[index] = {
      ...newSentences[index],
      text: newText
    }
    setSentences(newSentences)
  }

  // Update sentence translation
  const updateSentenceTranslation = (index: number, newTranslation: string) => {
    const newSentences = [...sentences]
    newSentences[index] = {
      ...newSentences[index],
      translation: newTranslation || undefined
    }
    setSentences(newSentences)
  }

  // Auto-translate using MyMemory API
  const autoTranslate = async (index: number) => {
    const sentence = sentences[index]
    if (!sentence.text) {
      alert('请先输入英文文本')
      return
    }

    try {
      const langPair = 'en|zh-CN'
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence.text)}&langpair=${langPair}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.responseStatus === 200) {
        updateSentenceTranslation(index, data.responseData.translatedText)
      } else {
        alert('翻译失败，请稍后重试')
      }
    } catch (error) {
      console.error('Translation error:', error)
      alert('翻译出错，请稍后重试')
    }
  }

  // Save to database
  const saveToDatabase = async () => {
    setSaveStatus("Saving...")
    try {
      const response = await fetch('/api/update-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          transcript: sentences
        })
      })

      if (!response.ok) throw new Error('Failed to save')

      setSaveStatus("✅ Saved successfully!")
      setTimeout(() => setSaveStatus(""), 3000)
    } catch (error: any) {
      setSaveStatus(`❌ Error: ${error.message}`)
    }
  }

  // Update current time and active sentence
  useEffect(() => {
    if (!audioRef.current) return

    const handleTimeUpdate = () => {
      const time = audioRef.current!.currentTime
      setCurrentTime(time)
      setActiveSentenceIndex(getActiveSentenceIndex(time))
    }

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [sentences])

  const currentSentence = sentences[currentIndex]

  // Check if sentence text matches audio (based on timestamps)
  const validateSentence = (sentence: Sentence): boolean => {
    const text = sentence.text.trim()
    return text.length > 0
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🎯 Audio Timestamp Marker</h1>

        {/* Load Material */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Load Material</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              placeholder="Enter exact material title (e.g., 'Canada: Provinces and Territories')"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={loadMaterial}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        {sentences.length > 0 && (
          <>
            {/* Audio Player */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Audio Player</h2>
              <audio
                ref={audioRef}
                src={audioSrc}
                controls
                className="w-full"
              />
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-600">
                  Current: {currentTime.toFixed(2)}s
                </span>
                <span className="font-semibold text-purple-600">
                  🎵 Playing: Sentence {activeSentenceIndex + 1}
                </span>
              </div>
            </div>

            {/* Real-time Preview - What will be shown during practice */}
            <div className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-purple-800">
                🔍 Practice Preview (Real-time)
                <span className="text-sm font-normal ml-2">- Based on timestamps</span>
              </h2>
              {activeSentenceIndex >= 0 && sentences[activeSentenceIndex] ? (
                <div className="bg-white rounded-lg p-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-purple-700">
                      Sentence {activeSentenceIndex + 1}
                    </span>
                    <span className="text-sm text-gray-600">
                      {sentences[activeSentenceIndex].startTime.toFixed(2)}s - {sentences[activeSentenceIndex].endTime.toFixed(2)}s
                    </span>
                  </div>
                  <p className="text-lg">
                    {sentences[activeSentenceIndex].text || <span className="text-red-500 italic">⚠️ Empty text - audio will play but nothing displayed!</span>}
                  </p>
                  {sentences[activeSentenceIndex].translation && (
                    <p className="text-sm text-gray-600 mt-2">
                      译文: {sentences[activeSentenceIndex].translation}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No active sentence</p>
              )}
              <p className="text-sm text-purple-700 mt-3">
                💡 This is what users will see during practice at current audio position
              </p>
            </div>

            {/* Current Sentence Editor */}
            {currentSentence && (
              <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-semibold">
                    Editing Sentence {currentIndex + 1} / {sentences.length}
                  </h2>
                  <div className="text-sm text-blue-700">
                    {currentSentence.startTime.toFixed(2)}s - {currentSentence.endTime.toFixed(2)}s
                  </div>
                </div>

                {/* Editable Text Area */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sentence Text (editable - adjust to match audio)
                  </label>
                  <textarea
                    value={currentSentence.text}
                    onChange={(e) => updateSentenceText(currentIndex, e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg"
                    placeholder="Enter the sentence text that matches the audio..."
                  />
                  {!validateSentence(currentSentence) && (
                    <p className="text-red-600 text-sm mt-1">⚠️ Text is empty - this will cause blank display during practice!</p>
                  )}
                </div>

                {/* Translation Editor */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      译文 Translation (editable)
                    </label>
                    <button
                      onClick={() => autoTranslate(currentIndex)}
                      className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      🤖 自动翻译
                    </button>
                  </div>
                  <textarea
                    value={currentSentence.translation || ''}
                    onChange={(e) => updateSentenceTranslation(currentIndex, e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    placeholder="输入或编辑中文翻译..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 提示：可以手动编辑，或点击"自动翻译"按钮生成翻译
                  </p>
                </div>

                {/* Timestamp Controls */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={markEndTime}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    ✓ Mark End Time ({currentTime.toFixed(2)}s)
                  </button>
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = currentSentence.startTime
                      }
                    }}
                    className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    ▶️ Jump to Start ({currentSentence.startTime.toFixed(2)}s)
                  </button>
                  <button
                    onClick={() => {
                      if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
                    }}
                    disabled={currentIndex === 0}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => {
                      if (currentIndex < sentences.length - 1) setCurrentIndex(currentIndex + 1)
                    }}
                    disabled={currentIndex === sentences.length - 1}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* All Sentences List with Text Editing */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">All Sentences (click to edit)</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {sentences.map((sentence, index) => {
                  const isActive = index === activeSentenceIndex
                  const isEditing = index === currentIndex

                  return (
                    <div
                      key={sentence.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        isActive
                          ? 'bg-purple-100 border-2 border-purple-500 shadow-md'
                          : isEditing
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold flex items-center gap-2">
                          Sentence {index + 1}
                          {isActive && <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">🎵 Playing</span>}
                        </span>
                        <span className="text-sm text-gray-600 font-mono">
                          {sentence.startTime.toFixed(2)}s - {sentence.endTime.toFixed(2)}s
                        </span>
                      </div>

                      {/* Editable textarea when selected */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">英文:</label>
                            <textarea
                              value={sentence.text}
                              onChange={(e) => updateSentenceText(index, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              rows={2}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center">
                              <label className="text-xs text-gray-500">译文:</label>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  autoTranslate(index)
                                }}
                                className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                              >
                                🤖 自动翻译
                              </button>
                            </div>
                            <textarea
                              value={sentence.translation || ''}
                              onChange={(e) => {
                                e.stopPropagation()
                                updateSentenceTranslation(index, e.target.value)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              rows={2}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                              placeholder="输入中文翻译..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm">{sentence.text || <span className="text-red-500 italic">Empty!</span>}</p>
                          {sentence.translation && (
                            <p className="text-xs text-gray-500 mt-1">💭 {sentence.translation}</p>
                          )}
                        </div>
                      )}

                      {!validateSentence(sentence) && !isEditing && (
                        <p className="text-red-600 text-xs mt-1">⚠️ Empty - will show blank during practice</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="bg-white rounded-lg shadow p-6">
              <button
                onClick={saveToDatabase}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-lg"
              >
                💾 Save to Database
              </button>
              {saveStatus && (
                <p className="mt-2 text-center text-sm">{saveStatus}</p>
              )}
              <p className="mt-3 text-xs text-gray-500 text-center">
                Saving will update the transcript with your timestamp and text changes
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
