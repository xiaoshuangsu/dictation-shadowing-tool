"use client"

import { useState, useEffect, useRef } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
  translation?: string  // 可选的中文翻译字段
}

interface ShadowingPanelProps {
  sentence: Sentence
  onComplete?: (isCorrect: boolean, durationSeconds: number) => void
  onNext?: () => void
  isLastSentence?: boolean
}

export default function ShadowingPanel({ sentence, onComplete, onNext, isLastSentence }: ShadowingPanelProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [userTranscript, setUserTranscript] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)

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

  useEffect(() => {
    setUserTranscript("")
    setShowResult(false)
    setRecordedAudioUrl(null)
    setMicError(null)
    recordedChunksRef.current = []

    // 重置播放时间跟踪
    setTotalPlayedSeconds(0)
    totalPlayedSecondsRef.current = 0
    setIsPlaying(false)

    // 记录页面开始时间（兜底逻辑）
    setPageStartTime(Date.now())
  }, [sentence.id])

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
              let interimTranscript = ''
              for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                  interimTranscript = result[0].transcript
                  console.log("Final transcript:", interimTranscript)
                  setUserTranscript(interimTranscript)
                  setShowResult(true)

                  // 使用 sentenceRef.current 获取最新的 sentence
                  const currentSentence = sentenceRef.current
                  // 直接在这里判断正确性
                  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
                  const isCorrect = normalize(interimTranscript) === normalize(currentSentence.text)
                  console.log("Pronunciation correct:", isCorrect, "Expected:", currentSentence.text)

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
              // 语音识别结束时，同时停止音频录制
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop()
              }
              setIsRecording(false)
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
      setRecordedAudioUrl(null)
      recordedChunksRef.current = []

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
    if (recognitionRef.current && mediaRecorderRef.current && isRecording) {
      try {
        recognitionRef.current.stop()
        mediaRecorderRef.current.stop()
        setIsRecording(false)
      } catch (err) {
        console.error("Error stopping recording:", err)
      }
    }
  }

  // 播放用户录音
  const playRecording = async () => {
    if (audioRef.current && recordedAudioUrl) {
      try {
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      } catch (err) {
        console.error("Error playing recording:", err)
      }
    }
  }

  // 播放原音
  const playOriginal = () => {
    if (originalAudioRef.current) {
      const audio = originalAudioRef.current
      audio.currentTime = sentence.startTime

      console.log('playOriginal - Starting playback at', sentence.startTime)

      // 使用 useRef 存储事件处理器，确保可以正确移除
      const handlePlay = () => {
        if (!isPlaying) {
          setIsPlaying(true)
          lastUpdateTimeRef.current = Date.now()
          console.log('Audio play event fired')
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

      audio.play().catch(err => {
        console.error('Failed to play audio:', err)
      })

      // 在句子的结束时间停止播放
      const durationToPlay = (sentence.endTime - sentence.startTime) * 1000
      setTimeout(() => {
        audio.pause()
        // 清理事件监听器
        audio.removeEventListener('play', handlePlay)
        audio.removeEventListener('pause', handlePause)
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
      }, durationToPlay + 100)
    }
  }

  // 判断读音正确性
  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
  }

  const isCorrect = userTranscript ? normalizeText(userTranscript) === normalizeText(sentence.text) : false

  return (
    <div>
      {/* 原音播放器（隐藏） */}
      <audio
        ref={originalAudioRef}
        src="/dictation-shadowing-tool/learn-english-via-listening-1001.mp3"
      />

      <p className="text-sm text-gray-500 mb-4">
        💡 影子跟读：播放音频后，点击麦克风跟读
      </p>

      {/* 参考文本 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-500 mb-1">原句：</p>
        <p className="text-base text-gray-800 mb-2">{sentence.text}</p>

        {/* 中文翻译 */}
        {sentence.translation && (
          <>
            <p className="text-sm text-gray-500 mb-1">释义：</p>
            <p className="text-base text-gray-600 italic">{sentence.translation}</p>
          </>
        )}
      </div>

      {/* 错误提示 */}
      {micError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{micError}</p>
        </div>
      )}

      {/* 用户读音结果 */}
      {showResult && userTranscript && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          isCorrect
            ? "bg-green-50 border-green-300"
            : "bg-orange-50 border-orange-300"
        }`}>
          <p className="text-xs text-gray-500 mb-1">你的发音：</p>
          <p className="text-base text-gray-800 mb-3">{userTranscript}</p>

          {/* 正确性判断 */}
          {isCorrect ? (
            <div className="flex items-center gap-2 text-green-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">发音准确！</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">继续加油！</span>
            </div>
          )}
        </div>
      )}

      {/* 音频对比区域 */}
      {recordedAudioUrl && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-gray-700 mb-3">🎵 音频对比</p>

          <div className="flex gap-3">
            {/* 播放原音 */}
            <button
              onClick={playOriginal}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">原音</span>
            </button>

            {/* 播放我的录音 */}
            <button
              onClick={playRecording}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">我的录音</span>
            </button>
          </div>

          {/* 音频播放器 */}
          <audio
            ref={audioRef}
            src={recordedAudioUrl}
            controls
            className="w-full mt-3"
            onError={(e) => console.error("Audio error:", e)}
          />
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
          <p className="text-sm text-red-500 animate-pulse">🎤 正在录音...</p>
        </div>
      )}
    </div>
  )
}
