'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// 硬编码配置用于测试
const SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm"

export default function TestSupabasePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [materials, setMaterials] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        console.log('Testing Supabase connection...')
        console.log('URL:', SUPABASE_URL)

        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        const { data, error } = await client
          .from('materials')
          .select('*')
          .limit(5)

        if (error) throw error

        console.log('Materials:', data)
        setMaterials(data || [])
        setStatus('success')
      } catch (err: any) {
        console.error('Error:', err)
        setError(err.message || 'Unknown error')
        setStatus('error')
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Supabase 连接测试</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-2">配置信息</h2>
          <p><strong>URL:</strong> {SUPABASE_URL}</p>
          <p><strong>Key:</strong> {SUPABASE_ANON_KEY.substring(0, 20)}...</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-lg font-semibold mb-2">状态</h2>
          {status === 'loading' && <p className="text-yellow-600">连接中...</p>}
          {status === 'success' && <p className="text-green-600">✓ 连接成功！</p>}
          {status === 'error' && (
            <div>
              <p className="text-red-600">✗ 连接失败</p>
              <p className="text-red-500 text-sm mt-2">{error}</p>
            </div>
          )}
        </div>

        {materials.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">数据（前 5 条）</h2>
            <ul className="space-y-2">
              {materials.map((m, i) => (
                <li key={i} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-gray-600">
                    {m.category} - {m.difficulty}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <a href="/materials" className="text-blue-600 hover:underline">
            ← 返回素材页面
          </a>
        </div>
      </div>
    </div>
  )
}
