'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// 硬编码配置（GitHub Pages 静态构建无法使用环境变量）
const CONFIG = {
  url: "https://cuxotlijjnxbsirpdkgr.supabase.co",
  key: "sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm"
}

export default function TestSupabasePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [materials, setMaterials] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [envCheck, setEnvCheck] = useState<any>({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined'
  })

  useEffect(() => {
    async function testConnection() {
      try {
        console.log('=== Supabase Connection Test ===')
        console.log('Using hardcoded config (not env vars)')
        console.log('URL:', CONFIG.url)
        console.log('Key:', CONFIG.key.substring(0, 20) + '...')
        console.log('')
        console.log('Env var check:')
        console.log('  NEXT_PUBLIC_SUPABASE_URL:', envCheck.envUrl)
        console.log('  Has URL:', envCheck.hasUrl)
        console.log('  Has Key:', envCheck.hasKey)

        const client = createClient(CONFIG.url, CONFIG.key)

        console.log('\nQuerying materials table...')

        const { data, error: err } = await client
          .from('materials')
          .select('*')
          .limit(10)

        if (err) {
          console.error('Supabase error:', err)
          throw err
        }

        console.log('Success! Materials:', data)
        console.log('Count:', data?.length || 0)

        setMaterials(data || [])
        setStatus('success')
      } catch (err: any) {
        console.error('Connection error:', err)
        setError(err.message || JSON.stringify(err))
        setStatus('error')
      }
    }

    testConnection()
  }, [envCheck])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Supabase 连接测试</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-2">环境变量检查</h2>
          <p className="mb-1"><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {envCheck.envUrl}</p>
          <p className="mb-1"><strong>hasUrl:</strong> {envCheck.hasUrl ? '✓' : '✗'}</p>
          <p><strong>hasKey:</strong> {envCheck.hasKey ? '✓' : '✗'}</p>
          {!envCheck.hasUrl && (
            <p className="text-red-600 mt-2 text-sm">
              ⚠️ 环境变量未配置！使用硬编码值进行测试。
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-2">连接状态</h2>
          {status === 'loading' && <p className="text-yellow-600">连接中...</p>}
          {status === 'success' && <p className="text-green-600">✓ 连接成功！找到 {materials.length} 条记录</p>}
          {status === 'error' && (
            <div>
              <p className="text-red-600">✗ 连接失败</p>
              <p className="text-red-500 text-sm mt-2 font-mono">{error}</p>
            </div>
          )}
        </div>

        {materials.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">数据（前 10 条）</h2>
            <ul className="space-y-2">
              {materials.map((m, i) => (
                <li key={i} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-gray-600">
                    {m.category} - {m.difficulty}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    {m.audio_path}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 space-y-2">
          <a href="/topics" className="text-blue-600 hover:underline block">
            ← 返回素材页面
          </a>
          <a href="/" className="text-blue-600 hover:underline block">
            ← 返回主页
          </a>
        </div>
      </div>
    </div>
  )
}
