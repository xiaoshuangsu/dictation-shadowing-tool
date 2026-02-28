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
  thumbnailPath?: string
  title?: string
  titleZh?: string
  onPlayEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
}

export default function VideoPlayer({
  videoSrc,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  thumbnailPath,
  onPlayEnd,
  onTimeUpdate
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const prevTriggerRef = useRef(0)

  // 使用 ref 存储最新的 currentSentence，避免闭包问题
  const currentSentenceRef = useRef(currentSentence)
  useEffect(() => {
    currentSentenceRef.current = currentSentence
  }, [currentSentence])

  // 固定音量
  const volume = 0.25

  // 初始化视频音量
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
    }
  }, [volume])

  const playSentence = () => {
    console.log('🎯 playSentence 被调用')
    console.log('videoRef.current:', videoRef.current)

    if (videoRef.current) {
      const video = videoRef.current

      // 调试日志
      const sentence = currentSentenceRef.current
      console.log('🎬 VideoPlayer.playSentence:', {
        sentenceId: sentence.id,
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        currentTime: video.currentTime,
        text: sentence.text?.substring(0, 50)
      })

      // 先暂停视频
      video.pause()

      // 设置时间和播放速率
      video.currentTime = sentence.startTime
      video.playbackRate = playbackRate
      video.volume = volume

      console.log('✅ 视频时间已设置:', {
        from: video.currentTime,
        to: sentence.startTime
      })

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
        const sentence = currentSentenceRef.current
        if (video.currentTime >= sentence.endTime) {
          console.log('⏹️ 句子播放结束', {
            sentenceId: sentence.id,
            currentTime: video.currentTime,
            endTime: sentence.endTime
          })
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

      // 监听播放状态
      video.addEventListener('playing', () => {
        console.log('🎬 视频正在播放')
      })

      video.addEventListener('pause', () => {
        console.log('⏸️ 视频已暂停, currentTime:', video.currentTime)
      })

      // 播放视频
      console.log('🎵 开始播放视频...', {
        volume: video.volume,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        readyState: video.readyState
      })

      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ 视频开始播放')
          setIsPlaying(true)
          setHasStarted(true)
        }).catch(err => {
          console.error('❌ VideoPlayer - Play error:', err)
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
      console.log('🎯 VideoPlayer: autoPlayTrigger changed', {
        trigger: autoPlayTrigger,
        sentenceId: currentSentence.id,
        startTime: currentSentence.startTime
      })
      setTimeout(() => {
        playSentence()
      }, 100)
    }
  }, [autoPlayTrigger, currentSentence.id, playbackRate])

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
      {/* 封面背景图 */}
      {!hasStarted && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/three-little-pigs-cover.png)' }}
        >
          {/* 黑色半透明遮罩 */}
          <div className="absolute inset-0 bg-black/30"></div>

          {/* 播放按钮 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <button
              onClick={playSentence}
              className="w-20 h-20 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
            >
              <svg className="w-10 h-10 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 视频元素 */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full"
        playsInline
        preload="metadata"
        style={{
          opacity: hasStarted ? 1 : 0,
          pointerEvents: hasStarted ? 'auto' : 'none'
        }}
      />

      {/* 播放时显示的返回封面按钮 */}
      {hasStarted && (
        <button
          onClick={() => setHasStarted(false)}
          className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          title="返回封面"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  )
}
