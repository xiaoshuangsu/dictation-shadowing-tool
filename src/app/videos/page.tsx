import Link from 'next/link'

export default function VideosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📺 视频素材库
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            来自 Cloudflare R2 的高质量视频内容
          </p>
        </div>

        {/* 建设中提示 */}
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            🚧 功能开发中
          </h2>
          <p className="text-gray-600 mb-6">
            视频素材库正在建设中，敬请期待！
          </p>
          <p className="text-sm text-gray-500 mb-6">
            您可以先访问：
          </p>
          <div className="space-y-3">
            <Link
              href="/topics"
              className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              📚 素材列表
            </Link>
            <Link
              href="/practice"
              className="block w-full py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center"
            >
              ✍️ 练习页面
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
