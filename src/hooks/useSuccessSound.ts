import { useRef, useCallback, useEffect } from 'react'

/**
 * 播放成功音效的 Hook
 * - 预加载音频，确保无延迟播放
 * - 支持快速连续点击，会中断前一个声音
 * - 使用静音状态而不是音量
 * - 从 localStorage 读取全局静音状态
 */
export function useSuccessSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isReadyRef = useRef(false)

  // 从 localStorage 获取全局静音状态
  const getGlobalMuted = (): boolean => {
    if (typeof window === 'undefined') return true // 默认静音
    try {
      const saved = localStorage.getItem('audioMuted')
      if (saved !== null) {
        return saved === 'true'
      }
    } catch (error) {
      console.warn('Failed to read audioMuted:', error)
    }
    return true // 默认静音（保护用户耳朵）
  }

  // 初始化音频元素（组件挂载时创建）
  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      // 使用完整的绝对路径
      const audioPath = process.env.NODE_ENV === 'production'
        ? '/dictation-shadowing-tool/success-notification.wav'
        : '/success-notification.wav'

      const audio = new Audio(audioPath)
      const isMuted = getGlobalMuted()
      audio.muted = isMuted // 使用静音状态
      audio.preload = 'auto' // 预加载

      // 监听音频可以播放事件（更早触发）
      const handleCanPlay = () => {
        if (!isReadyRef.current) {
          isReadyRef.current = true
          console.log('Success sound can play, muted:', isMuted)
        }
      }

      // 监听音频加载完成事件
      const handleCanPlayThrough = () => {
        isReadyRef.current = true
        console.log('Success sound ready to play through')
      }

      audio.addEventListener('canplay', handleCanPlay)
      audio.addEventListener('canplaythrough', handleCanPlayThrough)
      audio.addEventListener('error', (e) => {
        console.warn('Failed to load success sound:', e)
      })

      // 提前加载音频
      audio.load()

      audioRef.current = audio

      // 清理函数
      return () => {
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('canplaythrough', handleCanPlayThrough)
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
      }
    }
  }, [])

  /**
   * 播放成功音效
   * 如果正在播放，会中断前一个声音并重新播放
   */
  const playSuccessSound = useCallback(() => {
    if (audioRef.current) {
      const audio = audioRef.current
      const isMuted = getGlobalMuted()

      // 每次播放前都重新设置静音状态（确保同步全局静音状态）
      audio.muted = isMuted
      console.log('Success sound playing, muted:', isMuted)

      // 如果静音，不播放
      if (isMuted) {
        return
      }

      // 重置到开头
      audio.currentTime = 0

      // 直接播放
      audio.play().catch(err => {
        console.warn('Failed to play success sound:', err)
      })
    }
  }, [])

  return { playSuccessSound }
}
