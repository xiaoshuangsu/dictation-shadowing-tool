"use client"

import { useState, useRef, useEffect } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
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
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(true) // 🔴 强制静音初始化，绕过 iOS 自动播放限制
  const isFreePlayModeRef = useRef(false) // 🔴 使用 useRef 来立即生效
  const videoRef = useRef<HTMLVideoElement>(null)

  // 🔴 关键验证：只有路径完整时才渲染
  const isValidVideoSrc = videoSrc && videoSrc.endsWith('.mp4')
  const actualVideoSrc = isValidVideoSrc ? videoSrc : undefined

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
    setVideoError(null)
  }

  const handleLoadedMetadata = () => {
    console.log('===== Video Loaded Metadata =====')
    if (videoRef.current) {
      console.log('Video metadata:', {
        duration: videoRef.current.duration,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
        readyState: videoRef.current.readyState
      })
    }
    setVideoError(null)
  }

  const handleCanPlay = () => {
    console.log('===== Video Can Play =====')
    setVideoError(null)
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
      if (video.paused) {
        video.play().catch(err => {
          console.warn('Video play warning:', err)
        })
      }
    }
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
    if (videoRef.current && videoSrc) {
      console.log('===== VideoPlayer Props =====', {
        videoSrc: videoSrc?.substring(0, 80),
        thumbnailPath: thumbnailPath?.substring(0, 80),
      })
      setVideoError(null)
      videoRef.current.load()
    }
  }, [videoSrc, thumbnailPath])

  // 同步视频播放位置（当 currentSentence 变化时）
  useEffect(() => {
    // 🔴 自由观看模式下不进行同步
    if (isFreePlayModeRef.current) {
      return
    }

    if (videoRef.current && videoSrc && currentSentence) {
      const startTime = currentSentence.startTime
      if (Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
        videoRef.current.currentTime = startTime
      }
    }
  }, [currentSentence, videoSrc])

  // 持续同步 currentTime（音频播放时的实时同步）
  useEffect(() => {
    // 🔴 如果 currentTime 从 0 变为正数，说明用户点击了中栏播放控制，退出自由观看模式
    if (isFreePlayModeRef.current && currentTime > 0) {
      console.log('🔄 Exiting free play mode, entering practice mode')
      isFreePlayModeRef.current = false

      // 🔴 暂停视频，避免与音频冲突
      if (videoRef.current && !videoRef.current.paused) {
        console.log('⏸️ Pausing video to avoid audio conflict')
        videoRef.current.pause()
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
  }, [currentTime, videoSrc, isFreePlayModeRef.current])

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
          />
        )}
      </div>
    </div>
  )
}
