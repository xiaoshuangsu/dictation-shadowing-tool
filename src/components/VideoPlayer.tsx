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
  onDegraded,
}: VideoPlayerProps) {
  // 🔴 调试日志：组件入口
  console.log('🎬 [VideoPlayer] Component rendered with props:', {
    videoSrc,
    currentSentence: currentSentence.text,
    hasOnDegraded: !!onDegraded  // 🔴 检查回调是否存在
  })

  const [videoError, setVideoError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false) // 🔴 修复：默认不静音，让用户能听到声音
  const [isVideoPlaying, setIsVideoPlaying] = useState(false) // 🔴 追踪视频是否正在播放
  const [isVideoLoading, setIsVideoLoading] = useState(false) // 🔴 视频缓冲中状态
  const [isDegraded, setIsDegraded] = useState(false) // 🔴 视频降级状态（内部管理）
  const isFreePlayModeRef = useRef(false) // 🔴 使用 useRef 来立即生效
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMountedRef = useRef(true) // 🔴 组件挂载状态，防止卸载后执行操作
  const lastLogTimeRef = useRef(0) // 🔴 日志节流器

  // 🔴 视频降级检测
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingStartTimeRef = useRef<number>(0)
  const initialBufferedRef = useRef<number>(0)

  // 🔴 日志节流函数（每 5000ms 一次）
  const throttledLog = (message: string, force = false) => {
    const now = Date.now()
    if (force || now - lastLogTimeRef.current > 5000) {
      console.log(message)
      lastLogTimeRef.current = now
    }
  }

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

    let errorMessage = '视频加载失败，请直接开始听写/影子跟读练习'

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
      errorMessage = '视频加载失败，请直接开始听写/影子跟读练习'
    }

    setVideoError(errorMessage)
  }

  // 🔴 检测是否为移动端（改进的检测逻辑）
  const isMobile = () => {
    if (typeof window === 'undefined') return false

    // 方法1：检查 User Agent（更全面的关键字）
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ''
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|iP(hone|od)|Android.*Mobile|Windows Phone/i
    if (mobileRegex.test(userAgent)) {
      console.log('📱 [Mobile Detection] 通过 UserAgent 检测为移动端:', userAgent)
      return true
    }

    // 方法2：检查屏幕宽度（大屏手机可能 >= 768px）
    const width = window.innerWidth
    if (width < 768) {
      console.log('📱 [Mobile Detection] 通过屏幕宽度检测为移动端:', width)
      return true
    }

    // 方法3：检查触摸能力（移动端通常支持触摸）
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      console.log('📱 [Mobile Detection] 通过触摸能力检测为移动端')
      return true
    }

    console.log('💻 [Mobile Detection] 检测为桌面端')
    return false
  }

  // 🔴 视频降级检测函数（仅移动端，内部管理）
  const startLoadingTimeout = () => {
    // 🔴 只在移动端启用降级策略（桌面端网络较稳定，不需要降级）
    const mobile = isMobile()

    if (!mobile || isDegraded) {
      console.log('⏸️ [Video Degradation] 跳过降级检测:', {
        reason: !mobile ? '非移动端' : '已降级'
      })
      return
    }

    console.log('⏱️ [Video Degradation] 启动 5 秒超时检测...')

    // 清除之前的计时器
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    // 记录开始时间和初始缓冲量
    loadingStartTimeRef.current = Date.now()
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      initialBufferedRef.current = videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
    } else {
      initialBufferedRef.current = 0
    }

    // 5 秒后检查是否触发降级
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('⏰ [Video Degradation] 5秒超时检查触发')
      console.log('   videoRef.current:', !!videoRef.current)
      console.log('   isMountedRef.current:', isMountedRef.current)

      if (!videoRef.current || !isMountedRef.current) {
        console.log('⚠️ [Video Degradation] 组件已卸载或 video 不存在，跳过降级')
        return
      }

      const video = videoRef.current
      const mobile = isMobile()

      // 🔴 移动端：如果 5 秒后还在 loading/waiting 状态，直接降级
      if (mobile && isVideoLoading) {
        console.log('🚨 [Video Degradation] 移动端 5秒超时，视频仍在加载中，触发降级')

        // 🔴 彻底释放视频带宽
        video.pause()
        video.src = ""
        video.load()

        console.log('🗑️ [Video Degradation] 已清空 video.src，释放带宽')

        // 🔴 内部状态设置为已降级
        setIsDegraded(true)

        // 🔴 派发自定义事件通知父组件
        const event = new CustomEvent('videoDegraded', {
          detail: { reason: '5秒超时，视频仍在加载中' }
        })
        window.dispatchEvent(event)

        console.log('📢 [Video Degradation] 已派发 videoDegraded 事件')
        return
      }

      // 桌面端和移动端（已加载）：检查缓冲进度
      let hasProgress = false

      // 检查缓冲进度是否有明显增长
      if (video.buffered.length > 0) {
        const currentBuffered = video.buffered.end(video.buffered.length - 1)
        const progress = currentBuffered - initialBufferedRef.current
        hasProgress = progress > 0.5 // 缓冲增长超过 0.5 秒视为有进展

        console.log('📊 [Video Degradation] 缓冲进度检查:', {
          initial: initialBufferedRef.current.toFixed(2),
          current: currentBuffered.toFixed(2),
          progress: progress.toFixed(2),
          hasProgress: hasProgress
        })
      } else {
        console.log('📊 [Video Degradation] video.buffered.length = 0，没有任何缓冲数据')
      }

      // 如果 5 秒内没有明显进展，触发降级
      if (!hasProgress) {
        console.log('🚨 [Video Degradation] 5秒超时，缓冲无进展，触发降级')

        // 🔴 彻底释放视频带宽
        video.pause()
        video.src = ""
        video.load()

        console.log('🗑️ [Video Degradation] 已清空 video.src，释放带宽')

        // 🔴 内部状态设置为已降级
        setIsDegraded(true)

        // 🔴 派发自定义事件通知父组件
        const event = new CustomEvent('videoDegraded', {
          detail: { reason: '5秒超时，缓冲无进展' }
        })
        window.dispatchEvent(event)

        console.log('📢 [Video Degradation] 已派发 videoDegraded 事件')
      } else {
        console.log('✅ [Video Degradation] 缓冲有进展，继续等待')
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
    console.log('🎬 [Video Events] onLoadStart 触发')
    setVideoError(null)
    // 🔴 开始超时检测
    startLoadingTimeout()
  }

  const handleLoadedMetadata = () => {
    throttledLog('🎬 Video metadata loaded', true)
    setVideoError(null)
  }

  const handleCanPlay = () => {
    console.log('===== Video Can Play =====')
    console.log('🎬 [Video Events] onCanPlay 触发')
    setVideoError(null)
    setIsVideoLoading(false)

    // 🔴 移动端不清除超时检测，让5秒完整执行
    const mobile = isMobile()
    if (!mobile) {
      console.log('💻 桌面端：清除超时检测')
      clearLoadingTimeout()
    } else {
      console.log('📱 移动端：不清除超时检测，继续等待5秒判断')
    }
  }

  const handleProgress = () => {
    // 🔴 性能脱敏：移除高频日志，减少控制台输出
    // 🔴 不再清除超时检测，让5秒超时逻辑完整执行
    // 只有真正可以播放时（handleCanPlay）才清除超时
  }

  const handleWaiting = () => {
    console.log('🎬 [Video Events] onWaiting 触发（视频缓冲中）')
    setIsVideoLoading(true)
    // 🔴 开始超时检测
    startLoadingTimeout()
  }

  const handleStalled = () => {
    setIsVideoLoading(true)
  }

  const handleSuspend = () => {
    // 仅用于状态追踪，不执行任何操作
  }

  // 视频播放/暂停事件
  const handleVideoPlay = () => {
    throttledLog('🎬 Video play event')
    // 🔴 关键修复：播放开始时清除加载状态（兼容 Safari）
    setIsVideoLoading(false)
    setIsVideoPlaying(true)
    isFreePlayModeRef.current = true
  }

  const handleVideoPlaying = () => {
    // 🔴 确保加载状态被清除（备用）
    setIsVideoLoading(false)
    setIsVideoPlaying(true)
  }

  const handleVideoPause = () => {
    setIsVideoPlaying(false)
  }

  // 添加时间更新事件来监控播放状态
  const handleTimeUpdate = () => {
    // 🔴 性能脱敏：移除高频日志
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

      setVideoError(null)
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false // 标记组件已卸载
      // 🔴 清理超时检测计时器
      clearLoadingTimeout()
      // 🔴 清理时只暂停，不修改 src（避免设置当前页面 URL）
      if (videoRef.current) {
        try {
          videoRef.current.pause()
        } catch (e) {
          // 忽略清理时的错误
        }
      }
    }
  }, [videoSrc, thumbnailPath, onDegraded])

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

  // 🔴 关键修复：移除强制缓冲策略，让浏览器自然缓冲
  // 强制暂停会触发 Safari 的保护机制导致 Code 4 错误

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

  // 🔴 如果已降级，保留 video 元素但隐藏它（维持用户交互上下文）
  // 关键修复：不能返回 null，否则 Safari 会失去用户交互上下文，导致音频无法播放
  if (isDegraded) {
    console.log('🚫 [Video Degradation] 组件已降级，隐藏视频区域但保留 video 元素')
    return (
      <div key={actualVideoSrc || 'video-player-degraded'} className="hidden">
        {/* 🔴 关键：保留隐藏的 video 元素以维持 Safari 的用户交互上下文 */}
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
            {/* 🔴 加载状态图标 - 当视频缓冲中时显示 */}
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
