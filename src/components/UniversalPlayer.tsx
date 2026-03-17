"use client"

import { useMemo } from "react"
import AudioPlayer from "./AudioPlayer"
import VideoPlayer from "./VideoPlayer"
import YouTubePlayer from "./YouTubePlayer"

interface Sentence {
  id: number
  text: string
  startTime: number | string
  endTime: number | string
}

export interface UniversalPlayerProps {
  // 素材信息
  material: {
    source_type?: 'r2' | 'youtube'
    youtube_id?: string | null
    video_path?: string | null
    audio_path: string
    thumbnail_path?: string | null
    title?: string
    titleZh?: string
  }

  // 播放控制
  currentSentence: Sentence
  playbackRate?: number
  autoPlayTrigger?: number
  currentTime?: number

  // 回调函数
  onPlayEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onPlaybackTimeUpdate?: (totalPlayedSeconds: number) => void
  onLoadingChange?: (isLoading: boolean) => void
  onReady?: (playerElement: any) => void
  onDegraded?: () => void
  endBuffer?: number
}

/**
 * 统一播放器组件
 *
 * 根据素材类型自动选择合适的播放器：
 * - YouTube 视频 → YouTubePlayer
 * - R2 视频 → VideoPlayer
 * - R2 音频 → AudioPlayer
 */
export default function UniversalPlayer({
  material,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  currentTime = 0,
  onPlayEnd,
  onTimeUpdate,
  onPlaybackTimeUpdate,
  onLoadingChange,
  onReady,
  onDegraded,
  endBuffer
}: UniversalPlayerProps) {
  // 判断素材类型并选择合适的播放器
  const playerType = useMemo(() => {
    const { source_type, youtube_id, video_path } = material

    if (source_type === 'youtube' && youtube_id) {
      return 'youtube'
    } else if (source_type === 'r2' && video_path) {
      return 'r2-video'
    } else {
      // 默认使用音频播放器
      return 'r2-audio'
    }
  }, [material.source_type, material.youtube_id, material.video_path])

  console.log('[UniversalPlayer] 播放器类型:', playerType, {
    source_type: material.source_type,
    youtube_id: material.youtube_id,
    has_video_path: !!material.video_path
  })

  // 根据类型渲染对应的播放器
  switch (playerType) {
    case 'youtube':
      return (
        <YouTubePlayer
          youtubeId={material.youtube_id!}
          currentSentence={currentSentence}
          playbackRate={playbackRate}
          autoPlayTrigger={autoPlayTrigger}
          onPlayEnd={onPlayEnd}
          onTimeUpdate={onTimeUpdate}
          onLoadingChange={onLoadingChange}
          onReady={() => onReady?.(null)}
          endBuffer={endBuffer}
        />
      )

    case 'r2-video':
      return (
        <VideoPlayer
          videoSrc={material.video_path!}
          currentSentence={currentSentence}
          currentTime={currentTime}
          thumbnailPath={material.thumbnail_path || undefined}
          title={material.title}
          titleZh={material.titleZh}
          onDegraded={onDegraded}
        />
      )

    case 'r2-audio':
    default:
      return (
        <AudioPlayer
          audioSrc={material.audio_path}
          currentSentence={currentSentence}
          playbackRate={playbackRate}
          autoPlayTrigger={autoPlayTrigger}
          onPlayEnd={onPlayEnd}
          onTimeUpdate={onTimeUpdate}
          onPlaybackTimeUpdate={onPlaybackTimeUpdate}
          onLoadingChange={onLoadingChange}
          onReady={onReady}
          endBuffer={endBuffer}
        />
      )
  }
}

/**
 * 导出播放器类型枚举
 */
export type PlayerType = 'youtube' | 'r2-video' | 'r2-audio'

/**
 * 辅助函数：获取素材的播放器类型
 */
export function getPlayerType(material: {
  source_type?: 'r2' | 'youtube'
  youtube_id?: string | null
  video_path?: string | null
}): PlayerType {
  if (material.source_type === 'youtube' && material.youtube_id) {
    return 'youtube'
  } else if (material.source_type === 'r2' && material.video_path) {
    return 'r2-video'
  } else {
    return 'r2-audio'
  }
}
