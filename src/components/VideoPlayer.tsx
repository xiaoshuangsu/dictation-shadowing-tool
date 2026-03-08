"use client"

import { useState } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number
  endTime: number
}

interface VideoPlayerProps {
  videoSrc?: string
  currentSentence: Sentence
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
  thumbnailPath,
  hasPlayedCurrent = false,
  onPlayNext,
  onPlay,
  onReplay,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handlePlay = () => {
    setIsLoading(true)
    onPlay?.()
    // Reset loading state after a short delay
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleReplay = () => {
    setIsLoading(true)
    onReplay?.()
    setTimeout(() => setIsLoading(false), 500)
  }

  return (
    <div>
      {/* Video Thumbnail Display */}
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        <div
          className="absolute inset-0 bg-cover bg-center bg-gray-800"
          style={thumbnailPath ? { backgroundImage: `url(${thumbnailPath})` } : {}}
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

      {/* Control Buttons */}
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
