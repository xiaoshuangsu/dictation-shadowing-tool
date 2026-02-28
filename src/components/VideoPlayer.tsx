"use client"

import { useRef, useState, useEffect } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
}

interface VideoPlayerProps {
  videoSrc: string
  currentSentence: Sentence
  playbackRate?: number
  autoPlayTrigger?: number
  onPlayEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
}

export default function VideoPlayer({
  videoSrc,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  onPlayEnd,
  onTimeUpdate
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prevTriggerRef = useRef(0)

  // 固定音量
  const volume = 0.25

  // 初始化视频音量
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
    }
  }, [volume])

  const playSentence = () => {
    if (videoRef.current) {
      const video = videoRef.current

      // 设置时间和播放速率
      video.currentTime = currentSentence.startTime
      video.playbackRate = playbackRate
      video.volume = volume

      // 移动端：向下滚动
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setTimeout(() => {
          const currentScroll = window.pageYOffset || document.documentElement.scrollTop
          window.scrollTo({
            top: currentScroll + 300,
            behavior: 'smooth'
          })
        }, 100)
      }

      // 监听播放结束
      const handleTimeUpdate = () => {
        if (video.currentTime >= currentSentence.endTime) {
          video.pause()
          setIsPlaying(false)
          onPlayEnd?.()
        }

        if (onTimeUpdate) {
          onTimeUpdate(video.currentTime)
        }
      }

      // 添加事件监听
      video.addEventListener('timeupdate', handleTimeUpdate)

      // 播放视频
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true)
        }).catch(err => {
          console.error('VideoPlayer - Play error:', err)
          setIsPlaying(false)
        })
      }

      // 清理函数
      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate)
      }
    }
  }

  // Auto-play when trigger changes
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger
      setTimeout(() => {
        playSentence()
      }, 100)
    }
  }, [autoPlayTrigger, currentSentence.id, playbackRate])

  return (
    <div className="flex items-center gap-2">
      <video
        ref={videoRef}
        src={videoSrc}
        className="rounded-lg shadow-lg w-full max-w-2xl"
        playsInline
      />

      {/* Play/Replay Button */}
      <button
        onClick={playSentence}
        className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors flex-shrink-0"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d={isPlaying ? "M6 19h4V5H6v14zm8-14v14h4V5h-4z" : "M8 5v14l11-7z"} />
        </svg>
      </button>
    </div>
  )
}
