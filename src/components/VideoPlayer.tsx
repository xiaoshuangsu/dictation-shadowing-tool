"use client"

import { useState, useRef, useEffect, useCallback } from "react"

// 🔴 开发环境检测
const isDevelopment = process.env.NODE_ENV === 'development'

interface Sentence {
  id: number
  text: string
  startTime: number | string  // 🔴 允许字符串以保留精度 (如 "9.10")
  endTime: number | string     // 🔴 允许字符串以保留精度
}

interface VideoPlayerProps {
  videoSrc?: string
  currentSentence: Sentence
  currentTime?: number  // 用于音频播放时的实时同步
  thumbnailPath?: string
  title?: string
  titleZh?: string
}

export default function VideoPlayer({
  videoSrc,
  currentSentence,
  currentTime = 0,
  thumbnailPath,
}: VideoPlayerProps) {
  // 🔴 调试日志：组件入口
  console.log('🎬 [VideoPlayer] Component rendered with props:', { videoSrc, currentSentence: currentSentence.text })

  const [videoError, setVideoError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false) // 🔴 修复：默认不静音，让用户能听到声音
  const [isVideoPlaying, setIsVideoPlaying] = useState(false) // 🔴 追踪视频是否正在播放
  const isFreePlayModeRef = useRef(false) // 🔴 使用 useRef 来立即生效
  const videoRef = useRef<HTMLVideoElement>(null)
  const retryCountRef = useRef(0) // 🔴 重试次数计数器
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 🔴 重试超时定时器
  const isMountedRef = useRef(true) // 🔴 组件挂载状态，防止卸载后执行操作

  // 🔴 调试日志：查看接收到的 props
  console.log('🎬 [VideoPlayer] Received props.videoSrc:', videoSrc)

  // 🔴 关键验证：必须有 .mp4 后缀且来自 media.shadowhub.app
  const isValidVideoSrc = videoSrc &&
    videoSrc.includes('.mp4') &&
    videoSrc.includes('media.shadowhub.app')

  // 🔴 防御性编程：如果 videoSrc 不是来自 media.shadowhub.app，打印严重警告
  if (videoSrc && !videoSrc.includes('media.shadowhub.app')) {
    console.error('❌❌❌ [VideoPlayer] CRITICAL: videoSrc is NOT from media.shadowhub.app!')
    console.error('Invalid videoSrc:', videoSrc)
    console.error('This will cause the video tag to use the current page URL!')
  }

  const actualVideoSrc = isValidVideoSrc ? videoSrc : undefined

  console.log('🎬 [VideoPlayer] actualVideoSrc:', actualVideoSrc)

  // 🔴 如果 videoSrc 存在但没有 .mp4 后缀，打印警告
  if (videoSrc && !videoSrc.includes('.mp4')) {
    console.warn('⚠️ [VideoPlayer] Invalid videoSrc (missing .mp4 extension):', videoSrc)
  }

  // 详细的视频错误处理
  const handleVideoError = () => {
    const video = videoRef.current
    if (!video) return

    let errorMessage = '视频无法加载，请使用封面图练习'

    // 获取详细错误信息
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
      errorMessage = `${errorDetails[errorCode as keyof typeof errorDetails] || '加载失败'}，请使用封面图练习`
    }

    setVideoError(errorMessage)
  }

  // 视频加载事件
  const handleLoadStart = () => {
    console.log('===== Video Load Start =====')
    if (videoRef.current) {
      const video = videoRef.current
      console.log('Video element state:', {
        src: video.src?.substring(0, 80),
        currentSrc: video.currentSrc?.substring(0, 80),
        readyState: video.readyState,
        networkState: video.networkState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      })

      // 🔴 关键检查：如果 currentSrc 为空，说明 src 没有被正确设置
      if (!video.currentSrc) {
        console.error('❌ ERROR: video.currentSrc is empty! src was not set correctly!')
        console.error('Actual src attribute:', video.src)
      }
    }
    setVideoError(null)
  }

  const handleLoadedMetadata = () => {
    console.log('===== Video Loaded Metadata =====')
    if (videoRef.current) {
      console.log('Video metadata:', {
        duration: videoRef.current.duration,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
        readyState: videoRef.current.readyState,
      })
    }
    setVideoError(null)
  }

  const handleCanPlay = () => {
    console.log('===== Video Can Play =====')
    if (videoRef.current) {
      console.log('Video can play state:', {
        readyState: videoRef.current.readyState,
        currentTime: videoRef.current.currentTime,
      })
    }
    setVideoError(null)
  }

  const handleProgress = () => {
    if (videoRef.current) {
      const buffered = videoRef.current.buffered
      if (buffered.length > 0) {
        console.log('🔄 Video progress:', {
          bufferedRanges: buffered.length,
          firstRangeStart: buffered.start(0),
          firstRangeEnd: buffered.end(0),
          readyState: videoRef.current.readyState,
        })
      }
    }
  }

  const handleWaiting = () => {
    console.log('⏸️ Video waiting - 数据不足')
    if (videoRef.current) {
      console.log('Waiting state:', {
        readyState: videoRef.current.readyState,
        currentTime: videoRef.current.currentTime,
      })
    }
  }

  const handleStalled = () => {
    console.log('⚠️ Video stalled - 网络停止')
    if (videoRef.current) {
      const video = videoRef.current
      console.log('Stalled state:', {
        readyState: video.readyState,
        currentTime: video.currentTime,
        networkState: video.networkState,
        currentSrc: video.currentSrc?.substring(0, 80),
      })

      // 🔴 关键诊断：检查是否是混合内容问题
      if (typeof window !== 'undefined') {
        const pageProtocol = window.location.protocol
        const videoProtocol = new URL(video.currentSrc || '').protocol
        if (pageProtocol === 'http:' && videoProtocol === 'https:') {
          console.warn('⚠️ 混合内容警告：HTTP 页面加载 HTTPS 视频')
        }
      }

      // 🔴 指数退避重试机制（仅开发环境）
      if (isDevelopment && retryCountRef.current < 5) {
        const delayMs = Math.min(500 * Math.pow(3, retryCountRef.current), 10000) // 最大 10 秒
        console.log(`🔄 尝试重试加载视频 (${retryCountRef.current + 1}/5)，${delayMs}ms 后重试...`)

        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }

        retryTimeoutRef.current = setTimeout(() => {
          const currentVideo = videoRef.current
          if (currentVideo && actualVideoSrc) {
            retryCountRef.current++
            console.log(`🔄 执行重试，当前次数: ${retryCountRef.current}`)
            currentVideo.load() // 重新加载视频
          }
        }, delayMs)
      }
    }
  }

  const handleSuspend = () => {
    console.log('⏸️ Video suspend - 加载暂停')
    if (videoRef.current) {
      console.log('Suspend state:', {
        readyState: videoRef.current.readyState,
        currentTime: videoRef.current.currentTime,
        networkState: videoRef.current.networkState,
      })
    }
  }

  // 视频播放/暂停事件
  const handleVideoPlay = () => {
    console.log('🎬 Video playing - Entering free play mode')
    if (videoRef.current) {
      console.log('Video state:', {
        paused: videoRef.current.paused,
        currentTime: videoRef.current.currentTime,
        readyState: videoRef.current.readyState
      })

      // 🔴 确保视频继续播放（iOS 可能需要显式调用）
      const video = videoRef.current
      if (video.paused && isMountedRef.current) {
        video.play().catch(err => {
          // 🔴 优雅处理 AbortError 和其他播放错误
          if (err.name === 'AbortError') {
            console.log('ℹ️ Video play aborted (可忽略，通常是切换视频导致)')
          } else {
            console.warn('Video play warning:', err.name, err.message)
          }
        })
      }
    }
    setIsVideoPlaying(true) // 🔴 标记视频正在播放
    isFreePlayModeRef.current = true // 🔴 进入自由观看模式，禁用同步
  }

  const handleVideoPause = () => {
    console.log('⏸️ Video paused')
    if (videoRef.current) {
      console.log('Video state on pause:', {
        paused: videoRef.current.paused,
        currentTime: videoRef.current.currentTime,
        readyState: videoRef.current.readyState
      })
    }
    setIsVideoPlaying(false) // 🔴 标记视频已暂停
  }

  // 添加时间更新事件来监控播放状态
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime
      if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime) > 0) {
        console.log('⏱️ Video playing at:', currentTime.toFixed(1), 'seconds')
      }
    }
  }

  // 强制加载视频资源（当 videoSrc 变化时）
  useEffect(() => {
    isMountedRef.current = true // 标记组件已挂载

    if (videoRef.current && videoSrc) {
      // 🔴 防御性检查：确保 videoSrc 是有效的视频 URL
      if (!videoSrc.includes('media.shadowhub.app')) {
        console.error('❌❌❌ [VideoPlayer] useEffect: Rejecting invalid videoSrc!')
        console.error('videoSrc must be from media.shadowhub.app, got:', videoSrc)
        console.error('This prevents the browser from using the current page URL as video src')
        setVideoError('视频地址错误，请刷新页面重试')
        return // 🔴 阻止加载无效的视频源
      }

      if (!videoSrc.includes('.mp4')) {
        console.error('❌❌❌ [VideoPlayer] useEffect: videoSrc missing .mp4 extension!')
        console.error('Got:', videoSrc)
        setVideoError('视频格式错误，请刷新页面重试')
        return // 🔴 阻止加载无效的视频源
      }

      console.log('===== VideoPlayer Props =====', {
        videoSrc: videoSrc?.substring(0, 80),
        thumbnailPath: thumbnailPath?.substring(0, 80),
      })

      // 🔴 关键修复：不要手动修改 video.src，让 React 完全控制
      // 只调用 load() 来触发重新加载
      setVideoError(null)
      retryCountRef.current = 0
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false // 标记组件已卸载
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // 🔴 清理时只暂停，不修改 src（避免设置当前页面 URL）
      if (videoRef.current) {
        try {
          videoRef.current.pause()
        } catch (e) {
          // 忽略清理时的错误
        }
      }
    }
  }, [videoSrc, thumbnailPath])

  // 同步视频播放位置（当 currentSentence 变化时）
  useEffect(() => {
    // 🔴 自由观看模式下不进行同步
    if (isFreePlayModeRef.current) {
      return
    }

    if (videoRef.current && videoSrc && currentSentence) {
      // 🔴 确保 startTime 是数字类型（数据库可能返回字符串）
      const startTime = typeof currentSentence.startTime === 'string'
        ? parseFloat(currentSentence.startTime)
        : currentSentence.startTime

      if (Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
        videoRef.current.currentTime = startTime
      }
    }
  }, [currentSentence, videoSrc])

  // 持续同步 currentTime（音频播放时的实时同步）
  useEffect(() => {
    // 🔴 关键修复：当检测到音频播放（currentTime > 0）时，自动暂停视频
    // 无论视频是否在播放，都应该给音频让路（练习模式优先）
    if (isFreePlayModeRef.current && currentTime > 0) {
      console.log('🔄 Audio detected playing, pausing video for practice mode')
      isFreePlayModeRef.current = false

      // 🔴 暂停视频，避免与音频冲突
      if (videoRef.current && !videoRef.current.paused) {
        console.log('⏸️ Pausing video to avoid audio conflict')
        videoRef.current.pause()
        setIsVideoPlaying(false)
      }
    }

    // 🔴 自由观看模式下不进行同步，让用户自由观看
    if (isFreePlayModeRef.current) {
      return
    }

    if (videoRef.current && videoSrc && currentTime > 0) {
      // 只有当差异较大时才更新，避免频繁跳帧
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
        videoRef.current.currentTime = currentTime
      }
    }
  }, [currentTime, videoSrc, isFreePlayModeRef.current, isVideoPlaying])

  // 设置视频默认音量为 40%
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 0.4
      console.log('🎬 Video volume set to 40% (0.4)')
    }
  }, [videoSrc])

  // 如果没有视频源，只显示封面图片
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

  // 有视频源时，显示实际的视频播放器
  return (
    <div key={actualVideoSrc || 'video-player'}>
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        {videoError ? (
          // 视频加载失败时显示错误信息
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
            onPause={handleVideoPause}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onWaiting={handleWaiting}
            onStalled={handleStalled}
            onSuspend={handleSuspend}
          />
        )}
      </div>
    </div>
  )
}
