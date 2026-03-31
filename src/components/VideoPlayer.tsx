"use client"

import { useState, useRef, useEffect, memo } from "react"
import logger from '@/lib/utils/logger'

interface Sentence {
  id: number
  text: string
  startTime: number | string  // 允许字符串以保留精度 (如 "9.10")
  endTime: number | string     // 允许字符串以保留精度
}

interface VideoPlayerProps {
  videoSrc?: string
  currentSentence: Sentence
  currentTime?: number  // 用于音频播放时的实时同步
  thumbnailPath?: string
  title?: string
  titleZh?: string
  onDegraded?: () => void
}

function VideoPlayer({
  videoSrc,
  currentSentence,
  currentTime = 0,
  thumbnailPath,
  onDegraded,
}: VideoPlayerProps) {
  logger.debug('[VideoPlayer] Component rendered', { videoSrc, currentSentence: currentSentence.text, hasOnDegraded: !!onDegraded })

  const [videoError, setVideoError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [isDegraded, setIsDegraded] = useState(false)
  const isFreePlayModeRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMountedRef = useRef(true)
  const lastLogTimeRef = useRef(0)

  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingStartTimeRef = useRef<number>(0)
  const initialBufferedRef = useRef<number>(0)

  const throttledLog = (message: string, force = false) => {
    const now = Date.now()
    if (force || now - lastLogTimeRef.current > 5000) {
      logger.debug(message)
      lastLogTimeRef.current = now
    }
  }

  const isValidVideoSrc = videoSrc &&
    videoSrc.includes('.mp4') &&
    videoSrc.includes('media.shadowhub.app')

  if (videoSrc && !videoSrc.includes('media.shadowhub.app')) {
    console.error('❌❌❌ [VideoPlayer] CRITICAL: videoSrc is NOT from media.shadowhub.app!')
    console.error('Invalid videoSrc:', videoSrc)
    console.error('This will cause the video tag to use the current page URL!')
  }

  const actualVideoSrc = isValidVideoSrc ? videoSrc : undefined

  if (videoSrc && !videoSrc.includes('.mp4')) {
    logger.warn('[VideoPlayer] Invalid videoSrc (missing .mp4 extension):', videoSrc)
  }

  const handleVideoError = () => {
    const video = videoRef.current
    if (!video) return

    let errorMessage = '视频加载失败，请直接开始听写/影子跟读练习'

    if (video.error) {
      const errorCode = video.error.code
      const errorDetails = {
        1: 'MEDIA_ERR_ABORTED - 用户中止',
        2: 'MEDIA_ERR_NETWORK - 网络错误',
        3: 'MEDIA_ERR_DECODE - 视频解码失败',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 视频格式不支持'
      }
      const errorInfo = {
        code: errorCode,
        message: video.error.message,
        details: errorDetails[errorCode as keyof typeof errorDetails] || '未知错误',
        src: video.src,
        networkState: video.networkState,
        readyState: video.readyState,
        currentSrc: video.currentSrc
      }
      console.error('===== Video Error Details =====', errorInfo)
      errorMessage = '视频加载失败，请直接开始听写/影子跟读练习'
    }

    setVideoError(errorMessage)
  }

  const isMobile = () => {
    if (typeof window === 'undefined') return false

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ''
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|iP(hone|od)|Android.*Mobile|Windows Phone/i
    if (mobileRegex.test(userAgent)) {
      logger.debug('[Mobile Detection] 通过 UserAgent 检测为移动端:', userAgent)
      return true
    }

    const width = window.innerWidth
    if (width < 768) {
      logger.debug('[Mobile Detection] 通过屏幕宽度检测为移动端:', width)
      return true
    }

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      logger.debug('[Mobile Detection] 通过触摸能力检测为移动端')
      return true
    }

    logger.debug('[Mobile Detection] 检测为桌面端')
    return false
  }

  const startLoadingTimeout = () => {
    const mobile = isMobile()

    if (!mobile || isDegraded) {
      logger.debug('[Video Degradation] 跳过降级检测:', !mobile ? '非移动端' : '已降级')
      return
    }

    logger.debug('[Video Degradation] 启动 5 秒超时检测...')

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    loadingStartTimeRef.current = Date.now()
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      initialBufferedRef.current = videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
    } else {
      initialBufferedRef.current = 0
    }

    loadingTimeoutRef.current = setTimeout(() => {
      logger.debug('[Video Degradation] 5秒超时检查触发')

      if (!videoRef.current || !isMountedRef.current) {
        logger.debug('[Video Degradation] 组件已卸载或 video 不存在，跳过降级')
        return
      }

      const video = videoRef.current
      const mobile = isMobile()

      if (mobile && isVideoLoading) {
        logger.debug('[Video Degradation] 移动端 5秒超时，视频仍在加载中，触发降级')

        video.pause()
        video.src = ""
        video.load()

        logger.debug('[Video Degradation] 已清空 video.src，释放带宽')

        setIsDegraded(true)

        const event = new CustomEvent('videoDegraded', {
          detail: { reason: '5秒超时，视频仍在加载中' }
        })
        window.dispatchEvent(event)

        logger.debug('[Video Degradation] 已派发 videoDegraded 事件')
        return
      }

      let hasProgress = false

      if (video.buffered.length > 0) {
        const currentBuffered = video.buffered.end(video.buffered.length - 1)
        const progress = currentBuffered - initialBufferedRef.current
        hasProgress = progress > 0.5
      }

      if (!hasProgress) {
        logger.debug('[Video Degradation] 5秒超时，缓冲无进展，触发降级')

        video.pause()
        video.src = ""
        video.load()

        logger.debug('[Video Degradation] 已清空 video.src，释放带宽')

        setIsDegraded(true)

        const event = new CustomEvent('videoDegraded', {
          detail: { reason: '5秒超时，缓冲无进展' }
        })
        window.dispatchEvent(event)

        logger.debug('[Video Degradation] 已派发 videoDegraded 事件')
      } else {
        logger.debug('[Video Degradation] 缓冲有进展，继续等待')
      }
    }, 5000)
  }

  const clearLoadingTimeout = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }

  const handleLoadStart = () => {
    logger.debug('[Video Events] onLoadStart 触发')
    setVideoError(null)
    startLoadingTimeout()
  }

  const handleLoadedMetadata = () => {
    throttledLog('[VideoPlayer] Video metadata loaded', true)
    setVideoError(null)
  }

  const handleCanPlay = () => {
    logger.debug('[Video Events] onCanPlay 触发')
    setVideoError(null)
    setIsVideoLoading(false)

    const mobile = isMobile()
    if (!mobile) {
      logger.debug('[VideoPlayer] 桌面端：清除超时检测')
      clearLoadingTimeout()
    } else {
      logger.debug('[VideoPlayer] 移动端：不清除超时检测，继续等待5秒判断')
    }
  }

  const handleProgress = () => {
    // 性能优化：移除高频日志
  }

  const handleWaiting = () => {
    logger.debug('[Video Events] onWaiting 触发（视频缓冲中）')
    setIsVideoLoading(true)
    startLoadingTimeout()
  }

  const handleStalled = () => {
    setIsVideoLoading(true)
  }

  const handleSuspend = () => {
    // 仅用于状态追踪
  }

  const handleVideoPlay = () => {
    throttledLog('[VideoPlayer] Video play event')
    setIsVideoLoading(false)
    setIsVideoPlaying(true)
    isFreePlayModeRef.current = true
  }

  const handleVideoPlaying = () => {
    setIsVideoLoading(false)
    setIsVideoPlaying(true)
  }

  const handleVideoPause = () => {
    setIsVideoPlaying(false)
  }

  const handleTimeUpdate = () => {
    // 性能优化：移除高频日志
  }

  useEffect(() => {
    isMountedRef.current = true

    if (videoRef.current && videoSrc) {
      if (!videoSrc.includes('media.shadowhub.app')) {
        console.error('❌❌❌ [VideoPlayer] useEffect: Rejecting invalid videoSrc!')
        console.error('videoSrc must be from media.shadowhub.app, got:', videoSrc)
        console.error('This prevents the browser from using the current page URL as video src')
        setVideoError('视频地址错误，请刷新页面重试')
        return
      }

      if (!videoSrc.includes('.mp4')) {
        console.error('❌❌❌ [VideoPlayer] useEffect: videoSrc missing .mp4 extension!')
        console.error('Got:', videoSrc)
        setVideoError('视频格式错误，请刷新页面重试')
        return
      }

      logger.debug('[VideoPlayer] Props updated', {
        videoSrc: videoSrc?.substring(0, 80),
        thumbnailPath: thumbnailPath?.substring(0, 80),
      })

      setVideoError(null)
    }

    return () => {
      isMountedRef.current = false
      clearLoadingTimeout()
      if (videoRef.current) {
        try {
          videoRef.current.pause()
        } catch (e) {
          // 忽略清理时的错误
        }
      }
    }
  }, [videoSrc, thumbnailPath, onDegraded])

  useEffect(() => {
    if (isFreePlayModeRef.current) {
      return
    }

    if (videoRef.current && videoSrc && currentSentence) {
      const startTime = typeof currentSentence.startTime === 'string'
        ? parseFloat(currentSentence.startTime)
        : currentSentence.startTime

      if (Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
        videoRef.current.currentTime = startTime
      }
    }
  }, [currentSentence, videoSrc])

  useEffect(() => {
    if (isFreePlayModeRef.current && currentTime > 0) {
      logger.debug('[VideoPlayer] Audio detected playing, pausing video for practice mode')
      isFreePlayModeRef.current = false

      if (videoRef.current && !videoRef.current.paused) {
        logger.debug('[VideoPlayer] Pausing video to avoid audio conflict')
        videoRef.current.pause()
        setIsVideoPlaying(false)
      }
    }

    if (isFreePlayModeRef.current) {
      return
    }

    if (videoRef.current && videoSrc && currentTime > 0) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
        videoRef.current.currentTime = currentTime
      }
    }
  }, [currentTime, videoSrc, isVideoPlaying])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 0.4
      logger.debug('[VideoPlayer] Video volume set to 40% (0.4)')
    }
  }, [videoSrc])

  if (!videoSrc) {
    return (
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={thumbnailPath ? { backgroundImage: `url(${thumbnailPath})` } : { backgroundColor: '#1f2937' }}
        >
          <div className="absolute inset-0 bg-black/30"></div>
        </div>
      </div>
    )
  }

  if (isDegraded) {
    logger.debug('[Video Degradation] 组件已降级，隐藏视频区域但保留 video 元素')
    return (
      <div key={actualVideoSrc || 'video-player-degraded'} className="hidden">
        <video
          ref={videoRef}
          src={actualVideoSrc}
          crossOrigin="anonymous"
          playsInline
          webkit-playsinline="true"
          preload="none"
          style={{ display: 'none' }}
        />
      </div>
    )
  }

  return (
    <div key={actualVideoSrc || 'video-player'}>
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        {videoError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 p-4">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A9 9 0 0121 2.012 9 9 0 0118.455 5.788z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">视频加载失败</p>
            <p className="text-gray-500 text-xs mt-1">{videoError}</p>
            {videoSrc && (
              <p className="text-gray-600 text-xs mt-2 opacity-70">{videoSrc.substring(0, 50)}...</p>
            )}
            <p className="text-gray-400 text-xs mt-3">请使用封面图练习</p>
          </div>
        ) : (
          <>
            <video
              key={actualVideoSrc || 'video-element'}
              ref={videoRef}
              src={actualVideoSrc}
              className="w-full h-full object-cover"
              controls
              crossOrigin="anonymous"
              playsInline
              webkit-playsinline="true"
              muted={isMuted}
              preload="metadata"
              poster={thumbnailPath}
              onError={handleVideoError}
              onLoadStart={handleLoadStart}
              onLoadedMetadata={handleLoadedMetadata}
              onCanPlay={handleCanPlay}
              onPlay={handleVideoPlay}
              onPlaying={handleVideoPlaying}
              onPause={handleVideoPause}
              onTimeUpdate={handleTimeUpdate}
              onProgress={handleProgress}
              onWaiting={handleWaiting}
              onStalled={handleStalled}
              onSuspend={handleSuspend}
            />
            {isVideoLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-white text-sm mt-3">缓冲中...</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default memo(VideoPlayer)
