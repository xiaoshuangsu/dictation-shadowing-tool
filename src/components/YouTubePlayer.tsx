"use client"

import { useRef, useState, useEffect, useCallback } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number | string
  endTime: number | string
}

interface YouTubePlayerProps {
  youtubeId: string
  currentSentence: Sentence
  playbackRate?: number
  autoPlayTrigger?: number
  onPlayEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onPlaybackTimeUpdate?: (totalPlayedSeconds: number) => void
  onLoadingChange?: (isLoading: boolean) => void
  onReady?: () => void
  onDegraded?: () => void
  endBuffer?: number
  practiceMode?: boolean
  nextSentence?: Sentence | null
  transcript?: Sentence[]
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YouTubePlayer({
  youtubeId,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  onPlayEnd,
  onTimeUpdate,
  onPlaybackTimeUpdate,
  onLoadingChange,
  onReady,
  onDegraded,
  endBuffer = -0.2,
  practiceMode = false,
  nextSentence = null,
  transcript = []
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const prevTriggerRef = useRef(0)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPlayingRef = useRef(false)
  const isPracticeModeRef = useRef(false)
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null)

  const getSafeEndTime = useCallback((sentence: Sentence): number => {
    const endTime = typeof sentence.endTime === 'string'
      ? parseFloat(sentence.endTime)
      : sentence.endTime

    if (nextSentence) {
      const nextStartTime = typeof nextSentence.startTime === 'string'
        ? parseFloat(nextSentence.startTime)
        : nextSentence.startTime

      if (endTime > nextStartTime) {
        return Math.max(nextStartTime - 0.1, endTime - (endTime - nextStartTime))
      }
    }

    return endTime
  }, [nextSentence])

  const getCurrentSubtitle = useCallback((currentTime: number): { text: string; index: number } | null => {
    if (!transcript || transcript.length === 0) return null

    for (let i = 0; i < transcript.length; i++) {
      const sentence = transcript[i]
      const startTime = typeof sentence.startTime === 'string'
        ? parseFloat(sentence.startTime)
        : sentence.startTime
      const endTime = typeof sentence.endTime === 'string'
        ? parseFloat(sentence.endTime)
        : sentence.endTime

      const paddedEndTime = endTime + 0.25

      if (currentTime >= startTime && currentTime <= paddedEndTime) {
        return { text: sentence.text, index: i }
      }
    }

    return null
  }, [transcript])

  useEffect(() => {
    if (window.YT) {
      setIsPlayerReady(true)
      return
    }

    const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      setIsPlayerReady(true)
    }

    return () => {
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady = () => {}
      }
    }
  }, [])

  useEffect(() => {
    if (!isPlayerReady || !containerRef.current || playerRef.current) {
      return
    }

    const origin = window.location.origin.replace(/\/$/, '')
    const iframeId = `youtube-player-${youtubeId}`

    containerRef.current.innerHTML = ''

    const iframe = document.createElement('iframe')
    iframe.id = iframeId
    iframe.className = 'w-full h-full'

    const params = new URLSearchParams({
      enablejsapi: '1',
      playsinline: '1',
      controls: '0',
      modestbranding: '1',
      rel: '0',
      disablekb: '1',
      ...(origin && !origin.includes('localhost') && !origin.includes('127.0.0.1') ? { origin } : {})
    })

    iframe.src = `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true

    containerRef.current.appendChild(iframe)

    playerRef.current = new window.YT.Player(iframeId, {
      events: {
        onReady: (event: any) => {
          onReady?.()
          onLoadingChange?.(false)

          if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
            prevTriggerRef.current = autoPlayTrigger
            setTimeout(() => playSentence(), 100)
          }
        },
        onStateChange: (event: any) => {
          const playerState = event.data
          if (playerState === 1) {
            isPlayingRef.current = true
            onLoadingChange?.(false)
            startTimeUpdate()
          } else if (playerState === 2) {
            isPlayingRef.current = false
            stopTimeUpdate()
          } else if (playerState === 3) {
            onLoadingChange?.(true)
          } else if (playerState === 0) {
            isPlayingRef.current = false
            stopTimeUpdate()
          }
        },
        onError: (event: any) => {
          if (event.data === 2 && onDegraded) {
            onDegraded()
          }
        }
      }
    })

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      stopTimeUpdate()
    }
  }, [isPlayerReady, youtubeId])

  useEffect(() => {
    isPracticeModeRef.current = practiceMode
  }, [practiceMode])

  const startTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) return

    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime()
        onTimeUpdate?.(currentTime)

        const subtitleData = getCurrentSubtitle(currentTime)
        if (subtitleData) {
          setCurrentSubtitle(subtitleData.text)
        } else {
          setCurrentSubtitle(null)
        }

        if (onPlaybackTimeUpdate && isPlayingRef.current) {
          onPlaybackTimeUpdate((prev: number) => prev + 0.1)
        }

        if (isPracticeModeRef.current) {
          const safeEndTime = getSafeEndTime(currentSentence)

          if (currentTime >= safeEndTime + endBuffer) {
            playerRef.current.pauseVideo()
            const startTime = typeof currentSentence.startTime === 'string'
              ? parseFloat(currentSentence.startTime)
              : currentSentence.startTime
            playerRef.current.seekTo(startTime, true)
            isPlayingRef.current = false
            isPracticeModeRef.current = false
            stopTimeUpdate()
            onPlayEnd?.()
          }
        }
      }
    }, 100)
  }, [currentSentence, endBuffer, onTimeUpdate, onPlaybackTimeUpdate, onPlayEnd, getSafeEndTime, getCurrentSubtitle])

  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
    }
  }, [])

  const playSentence = useCallback(() => {
    if (!playerRef.current || !playerRef.current.playVideo) {
      return
    }

    const startTime = typeof currentSentence.startTime === 'string'
      ? parseFloat(currentSentence.startTime)
      : currentSentence.startTime

    const safeEndTime = getSafeEndTime(currentSentence)

    isPracticeModeRef.current = true

    if (playerRef.current.unMute) {
      playerRef.current.unMute()
    }
    if (playerRef.current.setVolume) {
      playerRef.current.setVolume(100)
    }

    if (playerRef.current.setPlaybackRate) {
      playerRef.current.setPlaybackRate(playbackRate)
    }

    playerRef.current.seekTo(startTime, true)

    setTimeout(() => {
      if (playerRef.current && playerRef.current.playVideo) {
        playerRef.current.playVideo()
      }
    }, 200)

    startTimeUpdate()
  }, [currentSentence, playbackRate, startTimeUpdate, getSafeEndTime, onPlayEnd])

  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger

      if (isPlayerReady) {
        setTimeout(() => playSentence(), 100)
      }
    }
  }, [autoPlayTrigger, isPlayerReady, playSentence])

  useEffect(() => {
    return () => {
      stopTimeUpdate()
    }
  }, [stopTimeUpdate])

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
      <div ref={containerRef} className="w-full h-full" />

      {currentSubtitle && (
        <div className="absolute bottom-8 left-0 right-0 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="inline-block bg-black/50 backdrop-blur-md rounded-lg px-4 py-2">
              <p className="text-white text-center font-bold text-base md:text-lg leading-relaxed" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                {currentSubtitle}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
