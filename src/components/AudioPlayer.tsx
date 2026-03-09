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
    audio.volume = 0.25  // 固定音量，与 ShadowingPanel 保持一致

    // 🔴 预先转换时间戳为数字，避免重复转换
    const startTime = typeof currentSentence.startTime === 'string'
      ? parseFloat(currentSentence.startTime)
      : currentSentence.startTime

    const endTime = typeof currentSentence.endTime === 'string'
      ? parseFloat(currentSentence.endTime)
      : currentSentence.endTime

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

      // 🔴 使用预转换的 endTime（数字类型）
      if (audio.currentTime >= endTime) {
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

    console.log('🎯 AudioPlayer seek:', {
      sentence: currentSentence.text?.substring(0, 30),
      startTime,
      endTime,
      originalType: typeof currentSentence.startTime
    })

    // 设置播放位置（使用预转换的数字类型 startTime）
    audio.currentTime = startTime

    // 🔴 移动端关键修复：等待 seeked 事件后再播放
    // 移动端（特别是 iOS）的 seek 操作是异步的，必须等待完成
    const handleSeeked = () => {
      // seek 完成后播放
      audio.play().then(() => {
        setIsPlaying(true)
        console.log('▶️ Playing from:', audio.currentTime)
      }).catch(err => {
        console.error('Play error after seek:', err)
        setIsPlaying(false)
      })
      // 移除 seeked 监听器（只需要触发一次）
      audio.removeEventListener('seeked', handleSeeked)
    }

    // 添加 seeked 事件监听器
    audio.addEventListener('seeked', handleSeeked)

    // 更新 cleanup 函数，包含 seeked 监听器
    const originalCleanup = cleanupRef.current
    cleanupRef.current = () => {
      audio.removeEventListener('seeked', handleSeeked)
      if (originalCleanup) originalCleanup()
    }
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
