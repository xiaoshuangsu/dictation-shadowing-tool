"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import logger from '@/lib/utils/logger'

interface Sentence {
  id: number
  text: string
  startTime: number | string
  endTime: number | string
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
  onReady?: (audioElement: HTMLAudioElement) => void
  endBuffer?: number
}

export default function AudioPlayer({
  audioSrc,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  onPlayEnd,
  onTimeUpdate,
  onPlaybackTimeUpdate,
  onLoadingChange,
  onReady,
  endBuffer = -0.2
}: AudioPlayerProps) {
  const audioRefInternal = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prevTriggerRef = useRef(0)
  const hasCalledReadyRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  const isPlayingRef = useRef(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const totalPlayedSecondsRef = useRef<number>(0)

  const START_COMPENSATION = 0.03

  const setLoading = (loading: boolean) => {
    if (onLoadingChange) {
      onLoadingChange(loading)
    }
  }

  const cleanupRef = useRef<(() => void) | null>(null)

  const clearListeners = () => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }

  // 初始化回调
  useEffect(() => {
    if (audioRefInternal.current && onReady && !hasCalledReadyRef.current) {
      hasCalledReadyRef.current = true
      onReady(audioRefInternal.current)
    }
  }, [onReady])

  // 核心播放逻辑：音频单例 + 内存级跳转
  const playSentence = useCallback(() => {
    const audio = audioRefInternal.current
    if (!audio) {
      console.error('[AudioPlayer] Audio element not found')
      return
    }

    clearListeners()

    audio.playbackRate = playbackRate
    audio.volume = 0.25

    const startTime = currentSentence.startTime
    const endTime = currentSentence.endTime

    const startNum = typeof startTime === 'string' ? parseFloat(startTime) : startTime
    const endNum = typeof endTime === 'string' ? parseFloat(endTime) : endTime

    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime)
      }

      if (isPlayingRef.current) {
        const now = Date.now()
        const elapsed = (now - lastUpdateTimeRef.current) / 1000
        lastUpdateTimeRef.current = now
        totalPlayedSecondsRef.current += elapsed

        if (onPlaybackTimeUpdate) {
          onPlaybackTimeUpdate(totalPlayedSecondsRef.current)
        }
      }
    }

    const checkEndTime = () => {
      if (audio.currentTime >= endNum - endBuffer) {
        audio.pause()
        setIsPlaying(false)
        isPlayingRef.current = false
        audio.currentTime = startNum

        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }

        clearListeners()
        if (onPlayEnd) onPlayEnd()
      } else {
        rafIdRef.current = requestAnimationFrame(checkEndTime)
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      isPlayingRef.current = true
      lastUpdateTimeRef.current = Date.now()
      setLoading(false)
    }

    const handlePause = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
    }

    const handleWaiting = () => {
      setLoading(true)
    }

    const handlePlaying = () => {
      setLoading(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('playing', handlePlaying)

    // 内存级跳转：不重新加载音频
    const seekTime = startNum + START_COMPENSATION
    audio.currentTime = seekTime

    // 立即播放
    audio.play().then(() => {
      setIsPlaying(true)
      isPlayingRef.current = true
      lastUpdateTimeRef.current = Date.now()
      rafIdRef.current = requestAnimationFrame(checkEndTime)
    }).catch(err => {
      console.error('[AudioPlayer] Play failed:', err)
      setIsPlaying(false)
      setLoading(false)
    })

    cleanupRef.current = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('playing', handlePlaying)
    }
  }, [currentSentence, playbackRate, endBuffer, onTimeUpdate, onPlaybackTimeUpdate, onPlayEnd])

  // 响应自动播放触发器
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger
      playSentence()
    }
  }, [autoPlayTrigger, playSentence])

  // 清理
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      clearListeners()
    }
  }, [])

  // 音频单例 + 全量预加载
  return <audio ref={audioRefInternal} src={audioSrc} preload="auto" />
}
