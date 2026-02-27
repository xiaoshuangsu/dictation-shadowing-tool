import { useRef, useCallback, useEffect } from 'react'

/**
 * 播放成功音效的 Hook
 * - 预加载音频，确保无延迟播放
 * - 支持快速连续点击，会中断前一个声音
 * - 移动端使用更低的音量
 */
export function useSuccessSound(volume: number = 0.05) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isReadyRef = useRef(false)

  // 检测是否为移动设备
  const isMobile = () => {
    if (typeof window === 'undefined') return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }

  // 移动端使用更低的音量
  const getActualVolume = () => {
    return isMobile() ? 0.02 : volume // 移动端音量更低
  }

  // 初始化音频元素（组件挂载时创建）
  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      // 使用完整的绝对路径
      const audioPath = process.env.NODE_ENV === 'production'
        ? '/dictation-shadowing-tool/success-notification.wav'
        : '/success-notification.wav'

      const audio = new Audio(audioPath)
      const actualVolume = getActualVolume()
      audio.volume = actualVolume
      audio.preload = 'auto' // 预加载

      // 监听音频可以播放事件（更早触发）
      const handleCanPlay = () => {
        if (!isReadyRef.current) {
          isReadyRef.current = true
          console.log('Success sound can play, volume:', actualVolume, 'isMobile:', isMobile())
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

      // 移动端：提前加载并播放一次（静音）来激活音频
      if (isMobile()) {
        audio.load()
        // 尝试在用户第一次交互时预热音频
        const enableAudioOnFirstInteraction = () => {
          audio.play().then(() => {
            audio.pause()
            audio.currentTime = 0
            console.log('Mobile audio pre-warmed')
          }).catch(() => {
            console.log('Mobile audio pre-warm failed (expected)')
          })
          document.removeEventListener('touchstart', enableAudioOnFirstInteraction)
          document.removeEventListener('click', enableAudioOnFirstInteraction)
        }
        document.addEventListener('touchstart', enableAudioOnFirstInteraction, { once: true })
        document.addEventListener('click', enableAudioOnFirstInteraction, { once: true })
      } else {
        audio.load()
      }

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
  }, [volume])

  /**
   * 播放成功音效
   * 如果正在播放，会中断前一个声音并重新播放
   */
  const playSuccessSound = useCallback(() => {
    if (audioRef.current) {
      const audio = audioRef.current
      const actualVolume = getActualVolume()

      // 移动端：每次播放时重新设置音量（可能被浏览器重置）
      if (isMobile()) {
        audio.volume = actualVolume
      }

      // 重置到开头
      audio.currentTime = 0

      // 直接播放（不克隆，更快）
      audio.play().catch(err => {
        console.warn('Failed to play success sound:', err)
      })
    }
  }, [])

  return { playSuccessSound }
}
