import { getR2PublicUrl, buildR2Key, R2ResourceType } from '@/lib/r2/client'
import videosData from '@data/videos.json'

interface VideoEntry {
  id: string
  title: string
  slug: string
  category: string
  r2Urls: {
    video: string
    audio?: string
    thumbnail?: string
  }
}

interface VideoEntry {
  id: string
  title: string
  slug: string
  category: string
  r2Urls: {
    video: string
    audio?: string
    thumbnail?: string
  }
  createdAt: string
  updatedAt: string
}

export default function VideosPage() {
  const videos = videosData.videos as VideoEntry[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📺 视频素材库
          </h1>
          <p className="text-lg text-gray-600">
            来自 Cloudflare R2 的高质量视频内容
          </p>
        </div>

        {/* 视频网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>

        {/* 添加新视频提示 */}
        <div className="mt-12 p-6 bg-white rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">➕ 添加新视频</h3>
          <p className="text-gray-600 mb-4">
            使用以下命令上传本地视频到 R2：
          </p>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
            <code>python3 scripts/upload_to_r2.py /path/to/video.mp4 --slug "my-video" --extract-audio --extract-thumbnail</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

function VideoCard({ video }: { video: VideoEntry }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
      {/* 视频预览 */}
      <div className="relative aspect-video bg-black">
        {video.r2Urls.thumbnail ? (
          <video
            src={video.r2Urls.video}
            poster={video.r2Urls.thumbnail}
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={video.r2Urls.video}
            controls
            className="w-full h-full"
          />
        )}
      </div>

      {/* 视频信息 */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-2">
          {video.title}
        </h3>

        {/* 标签 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {video.category}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            R2
          </span>
        </div>

        {/* 链接 */}
        <div className="space-y-2 text-sm">
          <a
            href={video.r2Urls.video}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <span>📹</span>
            <span className="truncate">视频</span>
          </a>

          {video.r2Urls.audio && (
            <a
              href={video.r2Urls.audio}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <span>🎵</span>
              <span className="truncate">音频</span>
            </a>
          )}

          {video.r2Urls.thumbnail && (
            <a
              href={video.r2Urls.thumbnail}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <span>🖼️</span>
              <span className="truncate">缩略图</span>
            </a>
          )}
        </div>

        {/* 更新时间 */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            更新于: {new Date(video.updatedAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>
    </div>
  )
}
