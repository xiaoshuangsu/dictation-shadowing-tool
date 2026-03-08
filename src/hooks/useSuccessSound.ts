import { useRef, useCallback, useEffect } from 'react'

/**
 * 检测是否为移动设备
 */
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
}

/**
 * 播放成功音效的 Hook
 * - 预加载音频，确保无延迟播放
 * - 支持快速连续点击，会中断前一个声音
 * - 从 localStorage 读取全局音量并应用比例
 * - 移动端禁用（因为音量无法控制，会导致爆鸣）
 */
export function useSuccessSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isReadyRef = useRef(false)
  const isMobile = useRef(isMobileDevice())

  // 获取成功音效音量（固定值，不再读取 localStorage）
  const getGlobalVolume = (): number => {
    return 0.1 // 固定 0.1（桌面端适中音量）
  }

  // 初始化音频元素（组件挂载时创建）
  useEffect(() => {
    // 移动端不加载音频
    if (isMobile.current) {
      console.log('Success sound disabled on mobile')
      return
    }

    if (!audioRef.current && typeof window !== 'undefined') {
      // 使用绝对路径，确保从根目录加载（避免三级路由路径偏移问题）
      const audioPath = '/success-notification.wav'
      console.log('Loading success sound from:', audioPath)

      const audio = new Audio(audioPath)
      const soundVolume = getGlobalVolume()
      audio.volume = soundVolume
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
   * 移动端不播放（因为音量无法控制，会导致爆鸣）
   */
  const playSuccessSound = useCallback(() => {
    // 移动端不播放
    if (isMobile.current) {
      console.log('Success sound skipped on mobile')
      return
    }

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
