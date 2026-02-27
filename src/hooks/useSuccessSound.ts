import { useRef, useCallback, useEffect } from 'react'

/**
 * 播放成功音效的 Hook
 * - 预加载音频，确保无延迟播放
 * - 支持快速连续点击，会中断前一个声音
 * - 音量默认为 0.15（降低以避免刺耳）
 */
export function useSuccessSound(volume: number = 0.15) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isReadyRef = useRef(false)

  // 初始化音频元素（组件挂载时创建）
  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      // 使用完整的绝对路径
      const audioPath = process.env.NODE_ENV === 'production'
        ? '/dictation-shadowing-tool/success-notification.wav'
        : '/success-notification.wav'

      const audio = new Audio(audioPath)
      audio.volume = volume
      audio.preload = 'auto' // 预加载

      // 监听音频加载完成事件，确保可以播放
      audio.addEventListener('canplaythrough', () => {
        isReadyRef.current = true
        console.log('Success sound ready to play')
      })

      audio.addEventListener('error', (e) => {
        console.warn('Failed to load success sound:', e)
      })

      audioRef.current = audio
    }

    // 清理函数
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [volume])

  /**
   * 播放成功音效
   * 如果正在播放，会中断前一个声音并重新播放
   */
  const playSuccessSound = useCallback(() => {
    if (audioRef.current && isReadyRef.current) {
      // 重置到开头
      audioRef.current.currentTime = 0

      // 快速播放（克隆节点以支持同时播放多个音效）
      const sound = audioRef.current.cloneNode(true) as HTMLAudioElement
      sound.volume = volume
      sound.play().catch(err => {
        console.warn('Failed to play success sound:', err)
      })
    }
  }, [volume])

  return { playSuccessSound }
}
