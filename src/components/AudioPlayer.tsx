"use client"

import { useRef, useState, useEffect } from "react"
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

  useEffect(() => {
    if (audioRefInternal.current && onReady && !hasCalledReadyRef.current) {
      hasCalledReadyRef.current = true

      const audio = audioRefInternal.current
      logger.debug('[AudioPlayer] Audio element created, readyState:', audio.readyState)

      const handleLoadStart = () => {
        logger.debug('[AudioPlayer] Load started')
      }

      const handleLoadedMetadata = () => {
        logger.debug('[AudioPlayer] Metadata loaded, readyState:', audio.readyState, 'Duration:', audio.duration)
      }

      const handleCanPlay = () => {
        logger.debug('[AudioPlayer] Audio can play, readyState:', audio.readyState)
      }

      const handleCanPlayThrough = () => {
        logger.debug('[AudioPlayer] Audio fully loaded, readyState:', audio.readyState)
      }

      const handleError = (e: Event) => {
        console.error('[AudioPlayer] Error loading audio:', e)
        const error = (e.target as HTMLAudioElement).error
        if (error) {
          console.error('[AudioPlayer] Error code:', error.code, 'Error message:', error.message)
        }
      }

      audio.addEventListener('loadstart', handleLoadStart)
      audio.addEventListener('loadedmetadata', handleLoadedMetadata)
      audio.addEventListener('canplay', handleCanPlay)
      audio.addEventListener('canplaythrough', handleCanPlayThrough)
      audio.addEventListener('error', handleError)

      logger.debug('[AudioPlayer] Waiting for user interaction to load audio')

      onReady(audio)

      return () => {
        audio.removeEventListener('loadstart', handleLoadStart)
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('canplaythrough', handleCanPlayThrough)
        audio.removeEventListener('error', handleError)
      }
    }
  }, [audioSrc, onReady])

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

  const playSentence = () => {
    const audio = audioRefInternal.current
    if (!audio) {
      console.error('[AudioPlayer] audio element not found')
      return
    }

    clearListeners()

    audio.playbackRate = playbackRate
    audio.volume = 0.25

    const startTime = currentSentence.startTime
    const endTime = currentSentence.endTime

    setLoading(true)

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
    }

    const handlePause = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
    }

    const handleCanPlay = () => {
      setLoading(false)
    }

    const handlePlaying = () => {
      setLoading(false)
    }

    const handleWaiting = () => {
      setLoading(true)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('waiting', handleWaiting)

    let seekComplete = false
    const handleSeeked = () => {
      seekComplete = true
      audio.play().then(() => {
        setIsPlaying(true)
        isPlayingRef.current = true
        lastUpdateTimeRef.current = Date.now()
        rafIdRef.current = requestAnimationFrame(checkEndTime)
      }).catch(err => {
        console.error('[AudioPlayer] Play error:', err)
        setIsPlaying(false)
        setLoading(false)
      })
      audio.removeEventListener('seeked', handleSeeked)
    }

    audio.addEventListener('seeked', handleSeeked)

    const isLoading = audio.readyState < 2
    const timeoutMs = isLoading ? 10000 : 2000

    const seekTimeout = setTimeout(() => {
      if (!seekComplete) {
        if (Math.abs(audio.currentTime - startNum) < 0.5) {
          seekComplete = true
          audio.removeEventListener('seeked', handleSeeked)
          audio.play().then(() => {
            setIsPlaying(true)
            isPlayingRef.current = true
            lastUpdateTimeRef.current = Date.now()
            rafIdRef.current = requestAnimationFrame(checkEndTime)
          }).catch(err => {
            console.error('[AudioPlayer] Play error after timeout:', err)
            setIsPlaying(false)
            setLoading(false)
          })
        } else {
          if (audio.readyState >= 2) {
            console.error('[AudioPlayer] Seek failed')
            setLoading(false)
          }
        }
      }
    }, timeoutMs)

    cleanupRef.current = () => {
      clearTimeout(seekTimeout)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('seeked', handleSeeked)
    }

    const trySeekAndPlay = () => {
      logger.debug('[AudioPlayer] User clicked, calling audio.load()...')
      logger.debug('[AudioPlayer] readyState before load:', audio.readyState)

      audio.load()

      if (audio.readyState < 2) {
        logger.debug('[AudioPlayer] Waiting for audio to load...')
        audio.addEventListener('canplay', () => {
          logger.debug('[AudioPlayer] Audio loaded, readyState:', audio.readyState)
          performSeek()
        }, { once: true })
        return
      }
      performSeek()
    }

    const performSeek = () => {
      try {
        const seekTime = startNum + START_COMPENSATION
        audio.currentTime = seekTime
      } catch (err) {
        console.error('[AudioPlayer] Failed to seek:', err)
        clearTimeout(seekTimeout)
        setLoading(false)
      }
    }

    setTimeout(() => {
      trySeekAndPlay()
    }, 50)
  }

  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger
      setTimeout(() => playSentence(), 50)
    }
  }, [autoPlayTrigger, currentSentence])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      clearListeners()
    }
  }, [])

  return <audio ref={audioRefInternal} src={audioSrc} preload="auto" />
}
