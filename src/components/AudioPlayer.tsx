"use client"

import { useRef, useState, useEffect } from "react"

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
  onReady
}: AudioPlayerProps) {
  const audioRefInternal = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prevTriggerRef = useRef(0)
  const hasCalledReadyRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (audioRefInternal.current && onReady && !hasCalledReadyRef.current) {
      hasCalledReadyRef.current = true
      onReady(audioRefInternal.current)
    }
  }, [audioSrc, onReady])

  const isPlayingRef = useRef(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const totalPlayedSecondsRef = useRef<number>(0)

  const START_COMPENSATION = 0.03
  const END_COMPENSATION = -0.2

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
      if (audio.currentTime >= endNum - END_COMPENSATION) {
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
      if (audio.readyState < 2) {
        audio.addEventListener('canplay', () => {
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

  return <audio ref={audioRefInternal} src={audioSrc} preload="auto" crossOrigin="anonymous" />
}
