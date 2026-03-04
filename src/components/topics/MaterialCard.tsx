import { type Material } from '@/lib/supabase/client'

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
  // R2 Worker URL（图片和视频已迁移到 R2）
  const R2_WORKER_URL = 'https://r2-proxy.suxiaoshuang2020.workers.dev'
  const SUPABASE_URL = 'https://cuxotlijjnxbsirpdkgr.supabase.co'

  // 获取缩略图 URL（优先使用 R2 Worker，兼容相对路径）
  const getThumbnailUrl = (path: string | null) => {
    if (!path) return null
    // 如果已经是完整 URL，直接使用
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    // 相对路径：使用 R2 Worker
    return `${R2_WORKER_URL}/${path}`
  }

  // 获取 Supabase fallback URL
  const getSupabaseUrl = (path: string | null) => {
    if (!path) return null
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    return `${SUPABASE_URL}/storage/v1/object/public/engnovate-audio/${path}`
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

  const handleClick = () => {
    if (onPlay) {
      onPlay(material)
    }
  }

  const thumbnailUrl = getThumbnailUrl(material.thumbnail_path)
  const supabaseUrl = getSupabaseUrl(material.thumbnail_path)

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const currentSrc = img.src

    // 如果当前是 R2 URL，尝试 Supabase Storage
    if (currentSrc.includes('r2-proxy') && supabaseUrl) {
      img.src = supabaseUrl
    } else {
      // 都失败了，隐藏图片，显示占位符
      img.style.display = 'none'
    }
  }

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
    >
      {/* 封面图 */}
      <div className="relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={material.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={handleImageError}
          />
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
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]">
          {material.title}
        </h3>

        {/* 元信息 */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatFileSize(material.audio_size)} MB</span>
          {material.duration && (
            <span>{formatDuration(material.duration)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
