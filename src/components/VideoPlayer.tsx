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
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const prevTriggerRef = useRef(0)
  const isInitializedRef = useRef(false)

  const currentSentenceRef = useRef(currentSentence)
  useEffect(() => {
    currentSentenceRef.current = currentSentence
  }, [currentSentence])

  const volume = 0.25

  // 初始化视频
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let rafId: number | null = null

    const initializeVideo = () => {
      if (isInitializedRef.current) return

      const video = videoRef.current
      if (!video) {
        timeoutId = setTimeout(initializeVideo, 100)
        return
      }

      isInitializedRef.current = true
      video.volume = volume

      const handleLoadedMetadata = () => {
        setIsMetadataLoaded(true)
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata)

      timeoutId = setTimeout(() => {
        video.load()
        if (video.readyState >= 1) { // HAVE_METADATA = 1
          setIsMetadataLoaded(true)
        }
      }, 50)
    }

    rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(initializeVideo, 50)
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  // 当 videoSrc 改变时，重新加载视频
  useEffect(() => {
    if (videoSrc && isInitializedRef.current) {
      const video = videoRef.current
      if (video) {
        setIsMetadataLoaded(false)
        setIsPlaying(false)
        setHasStarted(false)
        setIsLoading(false)
        video.load()
      }
    }
  }, [videoSrc])

  const playSentence = () => {
    if (videoRef.current && videoSrc) {
      const video = videoRef.current
      const sentence = currentSentenceRef.current

      video.pause()
      video.playbackRate = playbackRate
      video.volume = volume
      setIsLoading(true)

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)

        // 检查是否已缓冲到目标位置
        const targetTime = sentence.startTime
        const bufferedEnd = video.buffered.length > 0 ? video.buffered.end(0) : 0

        if (bufferedEnd < targetTime) {
          const onProgress = () => {
            const newBufferedEnd = video.buffered.length > 0 ? video.buffered.end(0) : 0
            if (newBufferedEnd >= targetTime) {
              setIsLoading(false)
              video.removeEventListener('progress', onProgress)

              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                const currentScroll = window.pageYOffset || document.documentElement.scrollTop
                window.scrollTo({ top: currentScroll + 300, behavior: 'smooth' })
              }

              setupPlaybackListeners()
              playVideo()
            }
          }

          video.addEventListener('progress', onProgress)
          return
        }

        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          const currentScroll = window.pageYOffset || document.documentElement.scrollTop
          window.scrollTo({ top: currentScroll + 300, behavior: 'smooth' })
        }

        setupPlaybackListeners()
        setIsLoading(true)
        playVideo()
      }

      const setupPlaybackListeners = () => {
        const handleTimeUpdate = () => {
          const sentence = currentSentenceRef.current
          if (video.currentTime >= sentence.endTime) {
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.pause()
            setIsLoading(false)
            setIsPlaying(false)
            onPlayEnd?.()
          }

          if (onTimeUpdate) {
            onTimeUpdate(video.currentTime)
          }
        }

        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('playing', () => setIsLoading(false), { once: true })
      }

      const playVideo = () => {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsLoading(false)
            setIsPlaying(true)
            setHasStarted(true)
          }).catch(err => {
            console.error('视频播放错误:', err)
            setIsLoading(false)
            setIsPlaying(false)
          })
        } else {
          setIsLoading(false)
          setIsPlaying(true)
          setHasStarted(true)
        }
      }

      video.addEventListener('seeked', onSeeked)
      video.currentTime = sentence.startTime

      return () => {
        video.removeEventListener('seeked', onSeeked)
      }
    }
  }

  // Auto-play when trigger changes
  useEffect(() => {
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = autoPlayTrigger
      setTimeout(() => playSentence(), 100)
    }
  }, [autoPlayTrigger, currentSentence.id, playbackRate])

  return (
    <div>
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        {!hasStarted && (
          <div
            className="absolute inset-0 z-10 bg-cover bg-center bg-gray-800"
            style={thumbnailPath ? { backgroundImage: `url(${thumbnailPath})` } : {}}
          >
            <div className="absolute inset-0 bg-black/30"></div>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <p className="text-white text-sm font-medium">加载中...</p>
                </div>
              ) : (
                <button
                  onClick={playSentence}
                  className="w-20 h-20 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                >
                  <svg className="w-10 h-10 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full"
          playsInline
          preload="auto"
        />
      </div>

      <div className="flex items-center gap-3 px-2 py-3 mt-3 bg-white rounded-lg border border-gray-200">
        <button
          onClick={playSentence}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="font-medium">开始</span>
        </button>

        <button
          onClick={playSentence}
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
