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
  onPlaybackTimeUpdate?: (totalPlayedSeconds: number) => void
  onLoadingChange?: (isLoading: boolean) => void
}

export default function AudioPlayer({
  audioSrc,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  onPlayEnd,
  onTimeUpdate,
  onPlaybackTimeUpdate,
  onLoadingChange
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prevTriggerRef = useRef(0)

  // 播放时间跟踪
  const isPlayingRef = useRef(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const totalPlayedSecondsRef = useRef<number>(0)

  // 通知加载状态
  const setLoading = (loading: boolean) => {
    if (onLoadingChange) {
      onLoadingChange(loading)
    }
  }

  // 清理函数
  const cleanupRef = useRef<(() => void) | null>(null)

  const clearListeners = () => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }

  const playSentence = () => {
    const audio = audioRef.current
    if (!audio) return

    clearListeners()

    // 设置参数
    audio.playbackRate = playbackRate
    audio.volume = 1.0

    // 开始加载
    setLoading(true)

    // 创建事件处理器
    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime)
      }

      // 播放时间统计
      if (isPlayingRef.current) {
        const now = Date.now()
        const elapsed = (now - lastUpdateTimeRef.current) / 1000
        lastUpdateTimeRef.current = now
        totalPlayedSecondsRef.current += elapsed

        if (onPlaybackTimeUpdate) {
          onPlaybackTimeUpdate(totalPlayedSecondsRef.current)
        }
      }

      // 检查是否播放结束
      if (audio.currentTime >= currentSentence.endTime) {
        audio.pause()
        setIsPlaying(false)
        isPlayingRef.current = false
        clearListeners()
        if (onPlayEnd) onPlayEnd()
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      isPlayingRef.current = true
      lastUpdateTimeRef.current = Date.now()
    }

    const handlePause = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
    }

    // 音频可以播放时（已缓冲足够数据）
    const handleCanPlay = () => {
      setLoading(false)
    }

    // 音频正在播放时
    const handlePlaying = () => {
      setLoading(false)
    }

    // 音频正在等待数据（缓冲中）
    const handleWaiting = () => {
      setLoading(true)
    }

    // 添加监听器
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('waiting', handleWaiting)

    cleanupRef.current = () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('waiting', handleWaiting)
    }

    // 设置播放位置并播放
    audio.currentTime = currentSentence.startTime

    // 等待seek完成后播放
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        audio.play().then(() => {
          setIsPlaying(true)
        }).catch(err => {
          console.error('Play error:', err)
          setIsPlaying(false)
        })
      })
    })
  }

  // Auto-play when trigger changes
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger
      setTimeout(() => playSentence(), 50)
    }
  }, [autoPlayTrigger, currentSentence])

  // 清理
  useEffect(() => {
    return () => clearListeners()
  }, [])

  return <audio ref={audioRef} src={audioSrc} preload="metadata" crossOrigin="anonymous" />
}
