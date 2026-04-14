import { type Material } from '@/lib/supabase/client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { TrainingModeModal } from './TrainingModeModal'

// 🔴 全局计数器，用于标识第一张图片
let imageCounter = 0

interface MaterialCardProps {
  material: Material
  onPlay?: (material: Material) => void
}

// 难度颜色映射
const DIFFICULTY_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-200',
  A2: 'bg-blue-100 text-blue-700 border-blue-200',
  B1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  B2: 'bg-red-100 text-red-700 border-red-200',
  C1: 'bg-purple-100 text-purple-700 border-purple-200',
  C2: 'bg-cyan-100 text-cyan-700 border-cyan-200',
}

export function MaterialCard({ material, onPlay }: MaterialCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isFirstImage, setIsFirstImage] = useState(false)
  const [shouldLoadImage, setShouldLoadImage] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [audioPreloaded, setAudioPreloaded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 🔴 调试：检查 is_premium 字段
  useEffect(() => {
    console.log('🔍 [MaterialCard] 素材信息:', {
      title: material.title,
      is_premium: material.is_premium,
      is_premium_type: typeof material.is_premium
    })
  }, [material.is_premium, material.title])

  // 🔴 标识第一张图片（用于调试）
  useEffect(() => {
    if (imageCounter === 0) {
      setIsFirstImage(true)
    }
    imageCounter++
  }, [])

  // 🔴 关键优化：使用 IntersectionObserver 提前触发加载（进入视口前 600px）
  useEffect(() => {
    if (!cardRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            // 卡片进入预加载区域（视口前 600px）
            setShouldLoadImage(true)
            observer.disconnect() // 只需要触发一次
          }
        })
      },
      {
        // 🔴 核心优化：rootMargin 让观察区域扩大到视口外 600px
        rootMargin: '600px',
        threshold: 0
      }
    )

    observer.observe(cardRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  // R2 URL 配置（统一使用 Worker 代理）
  const R2_WORKER_URL = 'https://media.shadowhub.app'
  // 🔥 物理脱离 Supabase：移除 SUPABASE_URL，不再使用 Supabase Storage

  // 获取缩略图 URL
  const getThumbnailUrl = (path: string | null) => {
    if (!path) return null

    // 如果是完整 URL，直接使用
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // 🔴 分流策略：图片直接使用 R2 Worker HTTPS 域名，跳过本地代理
    // 图片不涉及流媒体 Range 请求，直接请求 HTTPS 不会触发 CONNECTION_RESET
    return `${R2_WORKER_URL}/${path}`
  }

  // 获取音频 URL
  const getAudioUrl = (path: string | null) => {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    return `${R2_WORKER_URL}/${path}`
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return mb.toFixed(1)
  }

  // 格式化时长
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 🔴 核心功能：打开弹窗并预加载音频
  const handleOpenModal = (e?: React.MouseEvent) => {
    console.log('🔍 [MaterialCard] handleOpenModal 被调用:', {
      title: material.title,
      hasEvent: !!e,
      audioPreloaded: audioPreloaded
    })

    // 阻止事件冒泡和默认行为
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    // 打开弹窗
    setIsModalOpen(true)

    // 🔴 性能优化：弹窗打开时立即预加载音频
    if (!audioPreloaded && material.audio_path) {
      const audioUrl = getAudioUrl(material.audio_path)
      if (audioUrl) {
        console.log('🔍 [MaterialCard] 开始预加载音频:', audioUrl)
        audioRef.current = new Audio(audioUrl)

        // 静默预加载（不自动播放）
        audioRef.current.preload = 'auto'
        audioRef.current.load()

        audioRef.current.addEventListener('canplaythrough', () => {
          console.log('✅ [MaterialCard] 音频预加载完成:', material.title)
          setAudioPreloaded(true)
        }, { once: true })

        audioRef.current.addEventListener('error', () => {
          console.error('❌ [MaterialCard] 音频预加载失败:', material.title)
        }, { once: true })
      }
    }
  }

  // 🔴 卡片点击处理（封面/标题区域）
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('🔍 [MaterialCard] 卡片被点击:', material.title)
    handleOpenModal(e)
  }

  // 🔴 按钮点击处理
  const handleDictationClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('🔍 [MaterialCard] Dictation 按钮被点击:', material.title)
    handleOpenModal(e)
  }

  const handleShadowingClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('🔍 [MaterialCard] Shadowing 按钮被点击:', material.title)
    handleOpenModal(e)
  }

  const thumbnailUrl = getThumbnailUrl(material.thumbnail_path)
  // 🔥 物理脱离 Supabase：移除 supabaseUrl

  // 🔴 关键优化：使用回调函数预加载下一批图片
  const preloadNextBatch = useCallback(() => {
    if (!thumbnailUrl || !onPlay) return

    // 触发自定义事件，通知父组件预加载下一批
    window.dispatchEvent(new CustomEvent('materialCardVisible', {
      detail: { materialId: material.id }
    }))
  }, [material.id, thumbnailUrl, onPlay])

  // 🔴 当图片加载完成后，触发预加载下一批的信号
  useEffect(() => {
    if (imageLoaded && isFirstImage) {
      preloadNextBatch()
    }
  }, [imageLoaded, isFirstImage, preloadNextBatch])

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // 🔥 物理脱离 Supabase：不再 fallback 到 Supabase Storage
    // 直接隐藏图片，显示占位符
    img.style.display = 'none'
  }

  // 🔴 清理音频资源
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  return (
    <>
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      >
        {/* 封面图 */}
        <div className="relative aspect-video min-h-[180px] bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
          {thumbnailUrl ? (
            <>
              {/* 🔴 关键优化：只有当 shouldLoadImage 为 true 时才设置 src，否则使用空字符串 */}
              <img
                ref={imageRef}
                crossOrigin="anonymous"
                src={shouldLoadImage ? thumbnailUrl : undefined}
                alt={material.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={handleImageError}
                // 🔴 关键优化：优先使用 fetchpriority，loading="lazy" 仅用于非首屏
                fetchpriority={isFirstImage ? "high" : "low"}
                importance={isFirstImage ? "high" : "low"}
                decoding="async"
                style={{
                  opacity: imageLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease-in'
                }}
                onLoad={() => {
                  setImageLoaded(true)
                }}
              />
              {/* 加载指示器 */}
              {!imageLoaded && shouldLoadImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
                  <svg className="w-12 h-12 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V8a8 8 0 00-8 8z"></path>
                  </svg>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}

          {/* 播放按钮覆盖层 */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* 🔴 Pro 徽章（仅付费素材显示） */}
          {material.is_premium && (
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
                Pro
              </span>
            </div>
          )}

          {/* 难度标签 */}
          <div className="absolute top-3 right-3">
            <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${DIFFICULTY_COLORS[material.difficulty]}`}>
              {material.difficulty}
            </span>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {/* 分类标签 */}
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {material.category}
            </span>
          </div>

          {/* 标题 */}
          <h3 className="font-semibold text-gray-900 mb-4 line-clamp-2 min-h-[2.5rem]">
            {material.title}
          </h3>

          {/* 元信息 */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
            <span>{formatFileSize(material.audio_size)} MB</span>
            {material.duration && (
              <span>{formatDuration(material.duration)}</span>
            )}
          </div>

          {/* 🔴 恢复：Dictation 和 Shadowing 按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleDictationClick}
              className="flex-1 text-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
            >
              Dictation
            </button>
            <button
              onClick={handleShadowingClick}
              className="flex-1 text-center px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
            >
              Shadowing
            </button>
          </div>
        </div>
      </div>

      {/* 学习模式选择弹窗 */}
      <TrainingModeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        material={{
          id: material.id,
          title: material.title,
          category: material.category,
          slug: material.slug,
          audio_path: material.audio_path
        }}
      />
    </>
  )
}
