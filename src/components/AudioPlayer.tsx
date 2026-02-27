"use client"

import { useRef, useState, useEffect } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
}

interface AudioPlayerProps {
  audioSrc: string
  currentSentence: Sentence
  playbackRate?: number
  autoPlayTrigger?: number
  onPlayEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onPlaybackTimeUpdate?: (totalPlayedSeconds: number) => void // 新增：累计播放时间回调
}

// 从 localStorage 获取音量
const getSavedVolume = (): number => {
  if (typeof window === 'undefined') return 0.3 // 默认 0.3（温和适中）
  try {
    const saved = localStorage.getItem('audioVolume')
    if (saved !== null) {
      return parseFloat(saved)
    }
  } catch (error) {
    console.warn('Failed to read saved volume:', error)
  }
  return 0.3 // 默认 0.3
}

export default function AudioPlayer({ audioSrc, currentSentence, playbackRate = 1, autoPlayTrigger = 0, onPlayEnd, onTimeUpdate, onPlaybackTimeUpdate }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prevTriggerRef = useRef(0)

  // 音量控制（使用 volume 并设置合理的默认值）
  const [volume, setVolume] = useState<number>(getSavedVolume)

  // 初始化音频音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      console.log('AudioPlayer - Volume set to:', volume, 'from useEffect [volume]')
    }
  }, [volume])

  // 在 audioRef 改变时也设置音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      console.log('AudioPlayer - Initial volume set to:', volume, 'from useEffect [audioRef, volume]')
    }
  }, [audioRef, volume])

  // 监听 localStorage 变化（调试用）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'audioVolume' && e.newValue !== null) {
        const newVolume = parseFloat(e.newValue)
        console.log('AudioPlayer - localStorage audioVolume changed to:', newVolume)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // 真实播放时间跟踪
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const totalPlayedSecondsRef = useRef<number>(0)

  // 存储当前播放的 timeout 和清理函数
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 清理之前的播放状态
  const cleanupPreviousPlayback = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    // 不在这里暂停，让新的 play() 调用自然处理
    setIsPlaying(false)
    setIsAudioPlaying(false)
  }

  const playSentence = () => {
    cleanupPreviousPlayback()

    if (audioRef.current) {
      const audio = audioRef.current

      // 设置新的时间和播放速率
      audio.currentTime = currentSentence.startTime
      audio.playbackRate = playbackRate
      audio.volume = volume // 确保音量设置正确

      console.log('AudioPlayer - Playing sentence at', currentSentence.startTime, 'rate:', playbackRate, 'volume:', volume)

      // 添加播放时间跟踪
      const handlePlay = () => {
        if (!isAudioPlaying) {
          setIsAudioPlaying(true)
          lastUpdateTimeRef.current = Date.now()
          console.log('AudioPlayer - Audio started playing')
        }
      }

      const handlePause = () => {
        if (isAudioPlaying) {
          const now = Date.now()
          const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000
          totalPlayedSecondsRef.current += elapsedSeconds

          console.log(`AudioPlayer - Audio paused. Elapsed: ${elapsedSeconds.toFixed(2)}s, Total: ${totalPlayedSecondsRef.current.toFixed(2)}s`)

          // 通知父组件累计播放时间
          if (onPlaybackTimeUpdate) {
            onPlaybackTimeUpdate(totalPlayedSecondsRef.current)
          }

          setIsAudioPlaying(false)
        }
      }

      const handleTimeUpdate = () => {
        // 检查是否播放到指定时间，如果是则停止
        if (audio.currentTime >= currentSentence.endTime) {
          audio.pause()
          setIsPlaying(false)
          if (cleanupRef.current) {
            cleanupRef.current()
            cleanupRef.current = null
          }
          return
        }

        if (isAudioPlaying) {
          const now = Date.now()
          const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000
          lastUpdateTimeRef.current = now

          // 累计播放时间
          totalPlayedSecondsRef.current += elapsedSeconds

          // 通知父组件累计播放时间
          if (onPlaybackTimeUpdate) {
            onPlaybackTimeUpdate(totalPlayedSecondsRef.current)
          }
        }
      }

      const handleEnded = () => {
        if (isAudioPlaying) {
          const now = Date.now()
          const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000
          totalPlayedSecondsRef.current += elapsedSeconds

          console.log(`AudioPlayer - Audio ended. Total played: ${totalPlayedSecondsRef.current.toFixed(2)}s`)

          // 通知父组件累计播放时间
          if (onPlaybackTimeUpdate) {
            onPlaybackTimeUpdate(totalPlayedSecondsRef.current)
          }

          setIsAudioPlaying(false)
        }
      }

      // 添加事件监听器
      audio.addEventListener('play', handlePlay)
      audio.addEventListener('pause', handlePause)
      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('ended', handleEnded)

      // 保存清理函数
      cleanupRef.current = () => {
        audio.removeEventListener('play', handlePlay)
        audio.removeEventListener('pause', handlePause)
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
      }

      // 播放音频
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true)
        }).catch(err => {
          console.error('AudioPlayer - Play error:', err)
          setIsPlaying(false)
        })
      }
    }
  }

  // Set up timeupdate event listener
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime)
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [onTimeUpdate])

  // Auto-play when trigger changes
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger
      // Small delay to ensure the sentence has changed
      setTimeout(() => {
        playSentence()
      }, 100)
    }
  }, [autoPlayTrigger, currentSentence.id, playbackRate])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupPreviousPlayback()
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={audioSrc}
      />

      {/* Play/Replay Button */}
      <button
        onClick={playSentence}
        className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d={isPlaying ? "M6 19h4V5H6v14zm8-14v14h4V5h-4z" : "M8 5v14l11-7z"} />
        </svg>
      </button>

      {/* Replay Button */}
      <button
        onClick={playSentence}
        className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
        title="Replay"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  )
}
