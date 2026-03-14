"use client"

import { useRef, useState, useEffect } from "react"

interface Sentence {
  id: number
  text: string
  startTime: number | string  // 🔴 允许字符串以保留精度 (如 "9.10")
  endTime: number | string     // 🔴 允许字符串以保留精度
}

interface AudioPlayerProps {
  audioSrc: string
  currentSentence: Sentence
  playbackRate?: number
  autoPlayTrigger?: number
  onPlayEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onPlaybackTimeUpdate?: (totalPlayedSeconds: number) => void
  onLoadingChange?: (isLoading: boolean) => void
  onReady?: (audioElement: HTMLAudioElement) => void  // 🔴 新增：audio 元素就绪回调
}

export default function AudioPlayer({
  audioSrc,
  currentSentence,
  playbackRate = 1,
  autoPlayTrigger = 0,
  onPlayEnd,
  onTimeUpdate,
  onPlaybackTimeUpdate,
  onLoadingChange,
  onReady
}: AudioPlayerProps) {
  const audioRefInternal = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const prevTriggerRef = useRef(0)
  const hasCalledReadyRef = useRef(false)  // 🔴 确保只调用一次

  // 🔴 当 audio 元素就绪时，通知父组件（用于激活 Safari 播放权限）
  useEffect(() => {
    if (audioRefInternal.current && onReady && !hasCalledReadyRef.current) {
      hasCalledReadyRef.current = true
      onReady(audioRefInternal.current)
      console.log('🎵 AudioPlayer: onReady called, audio element passed to parent')
    }
  }, [audioSrc, onReady])

  // 播放时间跟踪
  const isPlayingRef = useRef(false)
  const lastUpdateTimeRef = useRef<number>(0)
  const totalPlayedSecondsRef = useRef<number>(0)

  // 通知加载状态
  const setLoading = (loading: boolean) => {
    if (onLoadingChange) {
      onLoadingChange(loading)
    }
  }

  // 清理函数
  const cleanupRef = useRef<(() => void) | null>(null)

  const clearListeners = () => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }

  const playSentence = () => {
    console.log('🎵🎵🎵 playSentence() called! 🎵🎵🎵')
    console.log('🎵 audioSrc:', audioSrc)
    console.log('🎵 currentSentence:', currentSentence)

    const audio = audioRefInternal.current
    if (!audio) {
      console.error('❌ audioRef.current is null!')
      return
    }

    console.log('✅ audio element exists, src:', audio.src)
    clearListeners()

    // 设置参数
    audio.playbackRate = playbackRate
    audio.volume = 0.4  // 固定音量 40%

    // 🔴 关键修复：直接使用原始值，保留精度
    const startTime = currentSentence.startTime
    const endTime = currentSentence.endTime

    // 检查是否有精度问题（仅用于调试）
    if (typeof startTime === 'string' && startTime.includes('.')) {
      const parts = startTime.split('.')
      if (parts.length > 1 && parts[1].length > 1) {
        console.log('AudioPlayer seek (original):', startTime)
      }
    }

    // 开始加载
    setLoading(true)

    // 🔴 移动端关键修复：使用数字类型进行 seek，但保留原始字符串用于调试
    const startNum = typeof startTime === 'string' ? parseFloat(startTime) : startTime
    const endNum = typeof endTime === 'string' ? parseFloat(endTime) : endTime

    console.log('🎯 AudioPlayer seek:', {
      sentence: currentSentence.text?.substring(0, 30),
      startTime,
      endTime,
      startNum,
      endNum,
      originalType: typeof currentSentence.startTime,
      currentTime: audio.currentTime,
      readyState: audio.readyState,
      networkState: audio.networkState
    })

    // 创建事件处理器
    const handleTimeUpdate = () => {
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime)
      }

      // 播放时间统计
      if (isPlayingRef.current) {
        const now = Date.now()
        const elapsed = (now - lastUpdateTimeRef.current) / 1000
        lastUpdateTimeRef.current = now
        totalPlayedSecondsRef.current += elapsed

        if (onPlaybackTimeUpdate) {
          onPlaybackTimeUpdate(totalPlayedSecondsRef.current)
        }
      }

      // 使用数字类型的 endTime
      if (audio.currentTime >= endNum) {
        console.log('⏹️ [AudioPlayer] 达到结束时间，停止播放:', {
          currentTime: audio.currentTime.toFixed(2),
          endNum: endNum,
          sentence: currentSentence.text?.substring(0, 30)
        })
        audio.pause()
        setIsPlaying(false)
        isPlayingRef.current = false
        clearListeners()
        if (onPlayEnd) onPlayEnd()
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      isPlayingRef.current = true
      lastUpdateTimeRef.current = Date.now()
    }

    const handlePause = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
    }

    const handleCanPlay = () => {
      console.log('🔊 Audio can play')
      setLoading(false)
    }

    const handlePlaying = () => {
      console.log('🔊 Audio playing')
      setLoading(false)
    }

    const handleWaiting = () => {
      console.log('🔊 Audio waiting (buffering...)')
      setLoading(true)
    }

    const handleLoadStart = () => {
      console.log('🔊 Audio load start, src:', audio.src)
    }

    const handleLoadedMetadata = () => {
      console.log('🔊 Audio metadata loaded:', {
        duration: audio.duration,
        readyState: audio.readyState
      })
    }

    // 添加基础监听器
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)

    // 🔴 移动端关键修复：等待 seeked 事件后再播放
    let seekComplete = false
    const handleSeeked = () => {
      seekComplete = true
      console.log('✅ Seeked to:', audio.currentTime, 'target:', startNum, 'diff:', Math.abs(audio.currentTime - startNum))
      console.log('   Audio state before play:', {
        readyState: audio.readyState,
        networkState: audio.networkState,
        paused: audio.paused,
        ended: audio.ended,
        currentTime: audio.currentTime,
        volume: audio.volume
      })
      // seek 完成后播放
      audio.play().then(() => {
        console.log('▶️ play() promise resolved')
        console.log('   Audio state after play:', {
          paused: audio.paused,
          currentTime: audio.currentTime,
          volume: audio.volume
        })
        setIsPlaying(true)
        console.log('▶️ Playing from:', audio.currentTime)
      }).catch(err => {
        console.error('❌ Play error after seek:', err)
        console.error('   Audio state:', {
          currentTime: audio.currentTime,
          readyState: audio.readyState,
          networkState: audio.networkState,
          paused: audio.paused,
          error: audio.error,
          volume: audio.volume
        })
        setIsPlaying(false)
        setLoading(false)
      })
      // 移除 seeked 监听器（只需要触发一次）
      audio.removeEventListener('seeked', handleSeeked)
    }

    // 先添加 seeked 监听器
    audio.addEventListener('seeked', handleSeeked)

    // 🔴 移动端 Safari 修复：添加超时检查
    // 如果音频正在加载（readyState < 2），给更多时间等待
    const isLoading = audio.readyState < 2
    const timeoutMs = isLoading ? 10000 : 2000  // 加载中：10秒，已加载：2秒

    const seekTimeout = setTimeout(() => {
      if (!seekComplete) {
        console.warn('⚠️ Seeked event timeout after', timeoutMs / 1000, 's')
        console.log('   Current time:', audio.currentTime, 'target:', startNum)
        console.log('   Audio state:', {
          readyState: audio.readyState,
          networkState: audio.networkState,
          paused: audio.paused,
          currentTime: audio.currentTime,
          volume: audio.volume,
          seeking: audio.seeking,
          duration: audio.duration,
          seekable: audio.seekable.length > 0 ? `${audio.seekable.start(0)}-${audio.seekable.end(0)}` : 'none'
        })
        // 检查是否已经接近目标时间（允许 0.5 秒误差）
        if (Math.abs(audio.currentTime - startNum) < 0.5) {
          console.log('✅ Time is close enough, forcing play')
          seekComplete = true
          audio.removeEventListener('seeked', handleSeeked)
          audio.play().then(() => {
            console.log('▶️ play() promise resolved (timeout path)')
            console.log('   Audio state after play:', {
              paused: audio.paused,
              currentTime: audio.currentTime,
              volume: audio.volume
            })
            setIsPlaying(true)
            console.log('▶️ Playing from:', audio.currentTime)
          }).catch(err => {
            console.error('❌ Play error after timeout:', err)
            console.error('   Audio state:', {
              currentTime: audio.currentTime,
              readyState: audio.readyState,
              networkState: audio.networkState,
              paused: audio.paused,
              error: audio.error,
              volume: audio.volume
            })
            setIsPlaying(false)
            setLoading(false)
          })
        } else {
          // 🔴 关键修复：如果音频仍在加载，不要报错，继续等待
          if (audio.readyState < 2) {
            console.warn('⏳ Audio still loading, extending timeout...')
            // 继续等待，不设置 seekComplete
            // canplay 事件最终会触发 performSeek
          } else {
            console.error('❌ Seek failed - time not close to target')
            console.error('   Expected:', startNum, 'Got:', audio.currentTime, 'Diff:', Math.abs(audio.currentTime - startNum))
            console.error('   This usually means the audio file is not fully loaded or the seek position is beyond the loaded range')
            setLoading(false)
          }
        }
      }
    }, timeoutMs)

    // 设置清理函数
    cleanupRef.current = () => {
      clearTimeout(seekTimeout)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }

    // 🔴 执行 seek 操作（使用数字类型）
    // 关键修复：等待音频加载到足够的数据后再 seek
    const trySeekAndPlay = () => {
      // 检查音频是否已加载到足够的数据
      if (audio.readyState < 2) {  // HAVE_CURRENT_DATA
        console.log('⏳ Waiting for audio to load...')
        console.log('   Current readyState:', audio.readyState, '(need >= 2)')
        // 等待 canplay 事件后再 seek
        audio.addEventListener('canplay', () => {
          console.log('✅ Audio loaded, now seeking to:', startNum)
          performSeek()
        }, { once: true })
        return
      }

      performSeek()
    }

    const performSeek = () => {
      try {
        console.log('🎯 About to seek, current state:', {
          currentTime: audio.currentTime,
          readyState: audio.readyState,
          networkState: audio.networkState,
          seeking: audio.seeking,
          duration: audio.duration,
          seekable: audio.seekable.length > 0 ? `${audio.seekable.start(0)}-${audio.seekable.end(0)}` : 'none'
        })
        audio.currentTime = startNum
        console.log('📍 Set currentTime to:', startNum, '(from:', startTime + ')')
        // 立即检查是否设置成功
        setTimeout(() => {
          console.log('📍 100ms after seek, currentTime:', audio.currentTime, 'readyState:', audio.readyState)
        }, 100)
      } catch (err) {
        console.error('❌ Failed to set currentTime:', err)
        clearTimeout(seekTimeout)
        setLoading(false)
      }
    }

    // 延迟执行，确保音频元素已经初始化
    setTimeout(() => {
      trySeekAndPlay()
    }, 50)
  }

  // Auto-play when trigger changes
  useEffect(() => {
    console.log('🎵 AudioPlayer: autoPlayTrigger changed to:', autoPlayTrigger, 'previous:', prevTriggerRef.current)
    if (autoPlayTrigger > 0 && autoPlayTrigger !== prevTriggerRef.current) {
      console.log('🎵 AudioPlayer: Triggering playSentence()')
      prevTriggerRef.current = autoPlayTrigger
      setTimeout(() => playSentence(), 50)
    }
  }, [autoPlayTrigger, currentSentence])

  // 清理
  useEffect(() => {
    return () => clearListeners()
  }, [])

  return <audio ref={audioRefInternal} src={audioSrc} preload="auto" crossOrigin="anonymous" />
}
