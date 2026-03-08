"use client"

import { useState } from "react"

export default function TestCorsPage() {
  const [results, setResults] = useState<Record<string, string>>({})

  const testUrl = async (label: string, url: string) => {
    setResults(prev => ({ ...prev, [label]: '测试中...' }))

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
      })

      const corsHeader = response.headers.get('Access-Control-Allow-Origin')
      const contentType = response.headers.get('Content-Type')

      setResults(prev => ({
        ...prev,
        [label]: `✅ 成功\nCORS: ${corsHeader || '无'}\nType: ${contentType}\nStatus: ${response.status}`
      }))
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [label]: `❌ 失败\n${error.message}`
      }))
    }
  }

  const testImageLoad = (label: string, url: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        setResults(prev => ({ ...prev, [label]: '✅ 图片加载成功' }))
        resolve()
      }

      img.onerror = () => {
        setResults(prev => ({ ...prev, [label]: '❌ 图片加载失败' }))
        resolve()
      }

      img.src = url
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">CORS 诊断测试</h1>

        {/* Fetch 测试 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">Fetch HEAD 测试（检查 CORS 头）</h2>

          <button
            onClick={() => testUrl('Worker URL', 'https://media.shadowhub.app/thumbnails/corruption.jpg')}
            className="px-4 py-2 bg-blue-500 text-white rounded mr-2 mb-2"
          >
            测试 Worker
          </button>

          <button
            onClick={() => testUrl('R2 Public', 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/thumbnails/corruption.jpg')}
            className="px-4 py-2 bg-green-500 text-white rounded mb-2"
          >
            测试 R2 Public
          </button>

          {results['Worker URL'] && (
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap">
              {results['Worker URL']}
            </pre>
          )}

          {results['R2 Public'] && (
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap">
              {results['R2 Public']}
            </pre>
          )}
        </div>

        {/* 图片加载测试 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">图片加载测试（浏览器实际渲染）</h2>

          <button
            onClick={() => testImageLoad('Worker Image', 'https://media.shadowhub.app/thumbnails/corruption.jpg')}
            className="px-4 py-2 bg-blue-500 text-white rounded mr-2 mb-2"
          >
            加载 Worker 图片
          </button>

          <button
            onClick={() => testImageLoad('R2 Public Image', 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/thumbnails/corruption.jpg')}
            className="px-4 py-2 bg-green-500 text-white rounded mb-2"
          >
            加载 R2 Public 图片
          </button>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm mb-1">Worker 图片：</p>
              <img
                crossOrigin="anonymous"
                src="https://media.shadowhub.app/thumbnails/corruption.jpg"
                alt="Worker"
                className="w-full rounded border"
                style={{ minHeight: '100px', backgroundColor: '#f0f0f0' }}
              />
              {results['Worker Image'] && (
                <p className="text-xs mt-1">{results['Worker Image']}</p>
              )}
            </div>

            <div>
              <p className="text-sm mb-1">R2 Public 图片：</p>
              <img
                crossOrigin="anonymous"
                src="https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev/thumbnails/corruption.jpg"
                alt="R2 Public"
                className="w-full rounded border"
                style={{ minHeight: '100px', backgroundColor: '#f0f0f0' }}
              />
              {results['R2 Public Image'] && (
                <p className="text-xs mt-1">{results['R2 Public Image']}</p>
              )}
            </div>
          </div>
        </div>

        {/* 环境信息 */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">当前环境</h3>
          <p className="text-sm">User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
          <p className="text-sm">页面 URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
        </div>
      </div>
    </div>
  )
}
