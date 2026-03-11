'use client'

import { useEffect, useState } from 'react'

export default function TestWorkerResponse() {
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    async function testWorker() {
      const testUrl = 'https://media.shadowhub.app/thumbnails/uWgaabEb_gQ.jpg'

      try {
        const response = await fetch(testUrl)
        const blob = await response.blob()

        setResult({
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          blobType: blob.type,
          blobSize: blob.size,
          headers: Object.fromEntries(response.headers.entries()),
        })

        // 创建图片 URL 进行显示测试
        const imageUrl = URL.createObjectURL(blob)
        const img = document.getElementById('test-image') as HTMLImageElement
        if (img) {
          img.src = imageUrl
        }
      } catch (error: any) {
        setResult({
          error: error.message,
        })
      }
    }

    testWorker()
  }, [])

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Worker 响应测试</h1>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold mb-2">响应信息：</h2>
        {result ? (
          <pre className="text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p>加载中...</p>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-bold mb-2">图片显示测试：</h2>
        <img
          id="test-image"
          alt="测试图片"
          className="max-w-full h-auto border"
          crossOrigin="anonymous"
          onLoad={() => console.log('✅ 图片加载成功')}
          onError={(e) => console.error('❌ 图片加载失败', e)}
        />
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h2 className="font-bold mb-2">直接 img 标签测试：</h2>
        <img
          src="https://media.shadowhub.app/thumbnails/uWgaabEb_gQ.jpg"
          alt="直接加载"
          className="max-w-full h-auto border"
          crossOrigin="anonymous"
          onLoad={() => console.log('✅ 直接加载成功')}
          onError={(e) => console.error('❌ 直接加载失败', e)}
        />
      </div>
    </div>
  )
}
