import { useRef, useCallback, useEffect } from 'react'

/**
 * 播放成功音效的 Hook
 * - 预加载音频，确保无延迟播放
 * - 支持快速连续点击，会中断前一个声音
 * - 从 localStorage 读取全局音量并应用比例
 */
export function useSuccessSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isReadyRef = useRef(false)

  // 从 localStorage 获取全局音量
  const getGlobalVolume = (): number => {
    if (typeof window === 'undefined') return 0.15 // 默认 0.15
    try {
      const saved = localStorage.getItem('audioVolume')
      if (saved !== null) {
        const vol = parseFloat(saved)
        // 成功音效是全局音量的 40%（更低）
        return vol * 0.4
      }
    } catch (error) {
      console.warn('Failed to read audioVolume:', error)
    }
    return 0.15 // 默认 0.15
  }

  // 初始化音频元素（组件挂载时创建）
  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      // 使用完整的绝对路径
      const audioPath = process.env.NODE_ENV === 'production'
        ? '/dictation-shadowing-tool/success-notification.wav'
        : '/success-notification.wav'

      const audio = new Audio(audioPath)
      const soundVolume = getGlobalVolume()
      audio.volume = soundVolume // 使用全局音量
      audio.preload = 'auto' // 预加载

      // 监听音频可以播放事件（更早触发）
      const handleCanPlay = () => {
        if (!isReadyRef.current) {
          isReadyRef.current = true
          console.log('Success sound can play, volume:', soundVolume)
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

      // 每次播放前都重新设置音量（确保同步全局音量）
      const soundVolume = getGlobalVolume()
      audio.volume = soundVolume

      // 如果音量为0，不播放
      if (soundVolume === 0) {
        console.log('Success sound volume is 0, skipping')
        return
      }

      // 重置到开头
      audio.currentTime = 0

      console.log('Success sound playing, volume:', soundVolume)

      // 直接播放
      audio.play().catch(err => {
        console.warn('Failed to play success sound:', err)
      })
    }
  }, [])

  return { playSuccessSound }
}
