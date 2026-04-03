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
  onLoadingChange?: (isLoading: boolean) => void
  onReady?: () => void
  endBuffer?: number
  practiceMode?: boolean  // 🔴 新增：是否启用练习模式（句子循环）
  nextSentence?: Sentence | null  // 🔴 新增：下一句（用于时间戳重叠保护）
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
  onLoadingChange,
  onReady,
  endBuffer = -0.2,
  practiceMode = false,  // 🔴 默认为自由播放模式
  nextSentence = null  // 🔴 默认无下一句
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const prevTriggerRef = useRef(0)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPlayingRef = useRef(false)
  const isPracticeModeRef = useRef(false)  // 🔴 标记是否在练习模式

  // 🔴 时间戳重叠保护：计算安全的结束时间
  const getSafeEndTime = useCallback((sentence: Sentence): number => {
    const endTime = typeof sentence.endTime === 'string'
      ? parseFloat(sentence.endTime)
      : sentence.endTime

    // 如果有下一句，检查是否重叠
    if (nextSentence) {
      const nextStartTime = typeof nextSentence.startTime === 'string'
        ? parseFloat(nextSentence.startTime)
        : nextSentence.startTime

      // 如果当前句结束时间超过下一句开始时间，强制修正
      if (endTime > nextStartTime) {
        console.warn('[YouTubePlayer] 检测到时间戳重叠，强制修正:', {
          originalEnd: endTime,
          nextStart: nextStartTime,
          overlap: endTime - nextStartTime
        })
        // 保留 100ms 缓冲
        return Math.max(nextStartTime - 0.1, endTime - (endTime - nextStartTime))
      }
    }

    return endTime
  }, [nextSentence])

  // 加载 YouTube Iframe API
  useEffect(() => {
    // 如果 API 已经加载，直接返回
    if (window.YT) {
      setIsPlayerReady(true)
      return
    }

    // 加载 YouTube Iframe API
    const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    // 设置 API 就绪回调
    window.onYouTubeIframeAPIReady = () => {
      console.log('[YouTubePlayer] YouTube API 已加载')
      setIsPlayerReady(true)
    }

    return () => {
      // 清理
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

    console.log('[YouTubePlayer] 初始化播放器:', youtubeId)

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId: youtubeId,
      playerVars: {
        playsinline: 1,
        controls: 0,  // 🔴 隐藏原生播放器控制，完全由练习区域控制
        modestbranding: 1,
        rel: 0,
        disablekb: 1  // 禁用键盘控制
      },
      events: {
        onReady: (event: any) => {
          console.log('[YouTubePlayer] 播放器已就绪')
          onReady?.()
          onLoadingChange?.(false)
        },
        onStateChange: (event: any) => {
          const playerState = event.data
          // YT.PlayerState: UNSTARTED=-1, ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
          if (playerState === 1) { // PLAYING
            isPlayingRef.current = true
            onLoadingChange?.(false)
            startTimeUpdate()
          } else if (playerState === 2) { // PAUSED
            isPlayingRef.current = false
            stopTimeUpdate()
          } else if (playerState === 3) { // BUFFERING
            onLoadingChange?.(true)
          } else if (playerState === 0) { // ENDED
            isPlayingRef.current = false
            stopTimeUpdate()
          }
        },
        onError: (event: any) => {
          console.error('[YouTubePlayer] 播放器错误:', event.data)
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

  // 时间更新
  const startTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) return

    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime()
        onTimeUpdate?.(currentTime)

        // 🔴 只在练习模式下检查句子结束时间
        if (isPracticeModeRef.current) {
          const safeEndTime = getSafeEndTime(currentSentence)

          if (currentTime >= safeEndTime + endBuffer) {
            // 暂停并重置到开始时间
            playerRef.current.pauseVideo()
            const startTime = typeof currentSentence.startTime === 'string'
              ? parseFloat(currentSentence.startTime)
              : currentSentence.startTime
            playerRef.current.seekTo(startTime, true)
            isPlayingRef.current = false
            isPracticeModeRef.current = false  // 🔴 退出练习模式
            stopTimeUpdate()
            onPlayEnd?.()
          }
        }
      }
    }, 100) // 每 100ms 更新一次
  }, [currentSentence, endBuffer, onTimeUpdate, onPlayEnd, getSafeEndTime])

  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
    }
  }, [])

  // 播放句子
  const playSentence = useCallback(() => {
    if (!playerRef.current || !playerRef.current.playVideo) {
      console.warn('[YouTubePlayer] 播放器未就绪')
      return
    }

    const startTime = typeof currentSentence.startTime === 'string'
      ? parseFloat(currentSentence.startTime)
      : currentSentence.startTime

    const safeEndTime = getSafeEndTime(currentSentence)

    console.log('[YouTubePlayer] 播放句子:', {
      startTime,
      endTime: safeEndTime,
      originalEndTime: currentSentence.endTime,
      playbackRate
    })

    // 🔴 设置练习模式标志
    isPracticeModeRef.current = true

    // 设置播放速度
    if (playerRef.current.setPlaybackRate) {
      playerRef.current.setPlaybackRate(playbackRate)
    }

    // 跳转到开始时间
    playerRef.current.seekTo(startTime, true)

    // 稍微延迟后开始播放，确保 seek 完成
    setTimeout(() => {
      if (playerRef.current && playerRef.current.playVideo) {
        playerRef.current.playVideo()
      }
    }, 200)

    // 启动时间更新
    startTimeUpdate()
  }, [currentSentence, playbackRate, startTimeUpdate, getSafeEndTime])

  // 自动播放触发
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current && isPlayerReady) {
      prevTriggerRef.current = autoPlayTrigger
      setTimeout(() => playSentence(), 100)
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
