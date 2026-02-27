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

// 固定音量（不再使用 localStorage，因为已删除音量控制按钮）
const getSavedVolume = (): number => {
  return 0.25 // 固定 0.25（温和适中）
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

      // 移动端：向上滚动页面，确保练习区域可见
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setTimeout(() => {
          const currentScroll = window.pageYOffset || document.documentElement.scrollTop
          // 向上滚动 200px，将播放器和练习区域移到视口中
          window.scrollTo({
            top: Math.max(0, currentScroll - 200),
            behavior: 'smooth'
          })
        }, 100)
      }

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
    </div>
  )
}
