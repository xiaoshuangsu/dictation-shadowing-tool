import { useRef, useCallback } from 'react'

/**
 * 播放成功音效的 Hook
 * - 预加载音频，确保无延迟播放
 * - 支持快速连续点击，会中断前一个声音
 * - 音量默认为 0.5
 */
export function useSuccessSound(volume: number = 0.5) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 初始化音频元素（只创建一次）
  if (!audioRef.current) {
    audioRef.current = new Audio('/success-notification.wav')
    audioRef.current.volume = volume
    audioRef.current.preload = 'auto' // 预加载
  }

  /**
   * 播放成功音效
   * 如果正在播放，会中断前一个声音并重新播放
   */
  const playSuccessSound = useCallback(() => {
    if (audioRef.current) {
      // 如果正在播放，先暂停
      if (!audioRef.current.paused) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0 // 重置到开头
      }

      // 播放音效
      audioRef.current.play().catch(err => {
        console.warn('Failed to play success sound:', err)
      })
    }
  }, [])

  return { playSuccessSound }
}
