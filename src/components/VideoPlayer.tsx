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
  currentTime?: number  // 添加 currentTime prop 用于同步
  thumbnailPath?: string
  title?: string
  titleZh?: string
  hasPlayedCurrent?: boolean
  onPlayNext?: () => void
  onPlay?: () => void
  onReplay?: () => void
}

interface VideoPlayerProps {
  videoSrc?: string
  currentSentence: Sentence
  currentTime?: number  // 添加 currentTime prop 用于同步
  thumbnailPath?: string
  title?: string
  titleZh?: string
  hasPlayedCurrent?: boolean
  onPlayNext?: () => void
  onPlay?: () => void
  onReplay?: () => void
}

export default function VideoPlayer({
  videoSrc,
  currentSentence,
  currentTime = 0,
  thumbnailPath,
  hasPlayedCurrent = false,
  onPlayNext,
  onPlay,
  onReplay,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

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

  // 视频加载开始诊断
  const handleLoadStart = () => {
    const video = videoRef.current
    if (video) {
      console.log('===== Video Load Start =====', {
        src: video.src,
        currentSrc: video.currentSrc,
        videoSrc: videoSrc
      })
      setVideoError(null)
    }
  }

  // 视频可以播放诊断
  const handleCanPlay = () => {
    console.log('===== Video Can Play =====')
    setVideoError(null)
  }

  // 强制加载视频资源（当 videoSrc 变化时）
  useEffect(() => {
    if (videoRef.current && videoSrc) {
      console.log('===== VideoPlayer Props =====', {
        videoSrc: videoSrc?.substring(0, 80),
        thumbnailPath: thumbnailPath?.substring(0, 80),
        hasVideoSrc: !!videoSrc,
        hasThumbnailPath: !!thumbnailPath
      })
      // 重置错误状态
      setVideoError(null)
      videoRef.current.load()
    }
  }, [videoSrc, thumbnailPath])

  // 当 videoSrc 变化时，重置所有相关状态
  useEffect(() => {
    if (videoSrc) {
      setVideoError(null)
      setIsLoading(false)
    }
  }, [videoSrc])

  // 同步视频播放位置（当 currentSentence 变化时）
  useEffect(() => {
    if (videoRef.current && videoSrc && currentSentence) {
      const startTime = currentSentence.startTime
      if (Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
        videoRef.current.currentTime = startTime
      }
    }
  }, [currentSentence, videoSrc])

  // 持续同步 currentTime（音频播放时的实时同步）
  useEffect(() => {
    if (videoRef.current && videoSrc && currentTime > 0) {
      // 只有当差异较大时才更新，避免频繁跳帧
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
        videoRef.current.currentTime = currentTime
      }
    }
  }, [currentTime, videoSrc])

  const handlePlay = () => {
    setIsLoading(true)
    onPlay?.()
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleReplay = () => {
    setIsLoading(true)
    onReplay?.()
    setTimeout(() => setIsLoading(false), 500)
  }

  // 如果没有视频源，显示封面图片
  if (!videoSrc) {
    return (
      <div>
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={thumbnailPath ? { backgroundImage: `url(${thumbnailPath})` } : { backgroundColor: '#1f2937' }}
          >
            <div className="absolute inset-0 bg-black/30"></div>

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                <p className="text-white text-sm font-medium mt-2">播放中...</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 py-3 mt-3 bg-white rounded-lg border border-gray-200">
          <button
            onClick={() => {
              if (hasPlayedCurrent && onPlayNext) {
                onPlayNext()
              } else {
                handlePlay()
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="font-medium">{hasPlayedCurrent ? "下一句" : "开始"}</span>
          </button>

          <button
            onClick={handleReplay}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            <span className="font-medium">重播</span>
          </button>
        </div>
      </div>
    )
  }

  // 有视频源时，显示实际的视频播放器
  return (
    <div key={videoSrc || 'video-player'}>
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
            key={videoSrc || 'video-element'}
            ref={videoRef}
            src={videoSrc || undefined}
            className="w-full h-full object-cover"
            controls
            playsInline
            webkit-playsinline="true"
            preload="metadata"
            crossOrigin="anonymous"
            poster={thumbnailPath}
            onError={handleVideoError}
            onLoadStart={handleLoadStart}
            onCanPlay={handleCanPlay}
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="text-white text-sm font-medium mt-2">播放中...</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-2 py-3 mt-3 bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => {
            if (hasPlayedCurrent && onPlayNext) {
              onPlayNext()
            } else {
              handlePlay()
            }
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="font-medium">{hasPlayedCurrent ? "下一句" : "开始"}</span>
        </button>

        <button
          onClick={handleReplay}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          <span className="font-medium">重播</span>
        </button>
      </div>
    </div>
  )
}
