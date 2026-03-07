"use client"

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"

export default function TestMobilePage() {
  const [status, setStatus] = useState<string[]>([])
  const [isMobile, setIsMobile] = useState(false)

  const addStatus = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setStatus(prev => [...prev, `[${timestamp}] ${msg}`])
  }

  useEffect(() => {
    addStatus(`是否移动设备: ${/iPad|iPhone|iPod|Android/i.test(navigator.userAgent)}`)
    setIsMobile(/iPad|iPhone|iPod|Android/i.test(navigator.userAgent))
  }, [])

  // 测试图片加载
  const testImage = (url: string, label: string) => {
    return new Promise((resolve, reject) => {
      addStatus(`开始测试 ${label}...`)
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        addStatus(`✅ ${label} 加载成功`)
        resolve(true)
      }
      img.onerror = () => {
        addStatus(`❌ ${label} 加载失败`)
        reject(false)
      }
      img.src = url
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">移动端资源测试</h1>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">测试日志</h2>
          <div className="space-y-1 max-h-64 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono">
            {status.map((log, i) => (
              <div key={i} className={log.includes('❌') ? 'text-red-600' : log.includes('✅') ? 'text-green-600' : 'text-gray-800'}>
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* 测试 1: R2 公共域名图片 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">测试 1: R2 公共域名图片（移动端兼容）</h2>
          <button
            onClick={() => testImage("https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/thumbnails/april-fools-day-joke-english-conversation.jpeg", "R2图片")}
            className="px-4 py-2 bg-blue-500 text-white rounded mb-2"
          >
            测试 R2 图片
          </button>
          <img
            crossOrigin="anonymous"
            src="https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/thumbnails/april-fools-day-joke-english-conversation.jpeg"
            alt="R2 图片"
            className="w-full rounded border"
            style={{ minHeight: '150px', backgroundColor: '#f0f0f0' }}
          />
        </div>

        {/* 测试 2: Supabase Storage 图片 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">测试 2: Supabase Storage 图片</h2>
          <button
            onClick={() => testImage("https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/thumbnails/april-fools-day-joke-english-conversation.jpeg", "Supabase图片")}
            className="px-4 py-2 bg-green-500 text-white rounded mb-2"
          >
            测试 Supabase 图片
          </button>
          <img
            crossOrigin="anonymous"
            src="https://cuxotlijjnxbsirpdkgr.supabase.co/storage/v1/object/public/engnovate-audio/thumbnails/april-fools-day-joke-english-conversation.jpeg"
            alt="Supabase 图片"
            className="w-full rounded border"
            style={{ minHeight: '150px', backgroundColor: '#f0f0f0' }}
          />
        </div>

        {/* 测试 3: 公共图片 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">测试 3: 公共 CDN 图片</h2>
          <button
            onClick={() => testImage("https://via.placeholder.com/400x200/0000FF/FFFFFF?text=Test+Image", "公共图片")}
            className="px-4 py-2 bg-purple-500 text-white rounded mb-2"
          >
            测试公共图片
          </button>
          <img
            src="https://via.placeholder.com/400x200/0000FF/FFFFFF?text=Test+Image"
            alt="公共图片"
            className="w-full rounded border"
          />
        </div>

        {/* 测试 4: R2 公共域名视频 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">测试 4: R2 公共域名视频（移动端兼容）</h2>
          <video
            crossOrigin="anonymous"
            src="https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/videos/1772532535.mp4"
            className="w-full rounded border"
            style={{ minHeight: '150px', backgroundColor: '#000' }}
            controls
            playsInline
            preload="metadata"
          />
        </div>

        {/* 测试 5: Supabase 视频 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">测试 5: 公共视频</h2>
          <video
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            className="w-full rounded border"
            style={{ minHeight: '150px', backgroundColor: '#000' }}
            controls
            playsInline
            preload="metadata"
          />
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">请点击测试按钮，观察：</p>
          <ul className="text-sm list-disc list-inside">
            <li>哪个图片源能加载成功？</li>
            <li>日志中显示 ✅ 还是 ❌？</li>
            <li>图片是否实际显示？</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
