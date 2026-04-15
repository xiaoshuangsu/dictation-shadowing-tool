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
}

// 全局声明 YouTube API
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
  nextSentence = null
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const prevTriggerRef = useRef(0)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPlayingRef = useRef(false)
  const isPracticeModeRef = useRef(false)

  // 时间戳重叠保护
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

  // 加载 YouTube Iframe API
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

  // 初始化播放器
  useEffect(() => {
    if (!isPlayerReady || !containerRef.current || playerRef.current) {
      return
    }

    // 🔥 手动创建 IFrame，完全控制 src URL
    const origin = window.location.origin.replace(/\/$/, '') // 🔥 移除末尾斜杠
    const iframeId = `youtube-player-${youtubeId}`

    // 清空容器
    containerRef.current.innerHTML = ''

    // 创建 IFrame
    const iframe = document.createElement('iframe')
    iframe.id = iframeId
    iframe.className = 'w-full h-full'
    iframe.src = `https://www.youtube.com/embed/${youtubeId}?` +
      `enablejsapi=1&` +
      `origin=${encodeURIComponent(origin)}&` +  // ✅ 硬编码 origin（无末尾斜杠）
      `playsinline=1&` +
      `controls=0&` +
      `modestbranding=1&` +
      `rel=0&` +
      `disablekb=1`
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')  // ✅ 修复跨域

    containerRef.current.appendChild(iframe)

    // 初始化 YouTube Player
    playerRef.current = new window.YT.Player(iframeId, {
      events: {
        onReady: (event: any) => {
          onReady?.()
          onLoadingChange?.(false)

          // 🔥 YouTube 播放器就绪后，先静音（绕过自动播放限制）
          if (playerRef.current && playerRef.current.mute) {
            playerRef.current.mute()
          }

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
          console.error('[YouTubePlayer] 播放器错误:', event.data)
          // 错误代码 2 = 无效参数
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

  // 同步 practiceMode
  useEffect(() => {
    isPracticeModeRef.current = practiceMode
  }, [practiceMode])

  // 时间更新
  const startTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) return

    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime()
        onTimeUpdate?.(currentTime)

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
  }, [currentSentence, endBuffer, onTimeUpdate, onPlaybackTimeUpdate, onPlayEnd, getSafeEndTime])

  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
    }
  }, [])

  const playSentence = useCallback(() => {
    if (!playerRef.current || !playerRef.current.playVideo) {
      console.warn('[YouTubePlayer] 播放器未就绪')
      return
    }

    const startTime = typeof currentSentence.startTime === 'string'
      ? parseFloat(currentSentence.startTime)
      : currentSentence.startTime

    const safeEndTime = getSafeEndTime(currentSentence)

    isPracticeModeRef.current = true

    if (playerRef.current.setPlaybackRate) {
      playerRef.current.setPlaybackRate(playbackRate)
    }

    playerRef.current.seekTo(startTime, true)

    // 🔥 立即播放（YouTube playVideo() 不返回 Promise）
    setTimeout(() => {
      if (playerRef.current && playerRef.current.playVideo) {
        playerRef.current.playVideo()
      }
    }, 200)

    startTimeUpdate()
  }, [currentSentence, playbackRate, startTimeUpdate, getSafeEndTime, onPlayEnd])

  // 自动播放触发
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger

      if (isPlayerReady) {
        setTimeout(() => playSentence(), 100)
      }
    }
  }, [autoPlayTrigger, isPlayerReady, playSentence])

  // 清理
  useEffect(() => {
    return () => {
      stopTimeUpdate()
    }
  }, [stopTimeUpdate])

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
