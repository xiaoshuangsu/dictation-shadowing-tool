'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { MaterialCard } from '@/components/materials/MaterialCard'

// 硬编码 Supabase 配置（GitHub Pages 静态构建无法使用环境变量）
const supabase = createClient(
  'https://cuxotlijjnxbsirpdkgr.supabase.co',
  'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
)

type Material = {
  id: string
  title: string
  category: string
  difficulty: 'A1' | 'A2' | 'B1' | 'B2'
  audio_path: string
  thumbnail_path: string | null
  audio_size: number
  duration: number | null
  play_count: number
  created_at: string
  updated_at: string
}

// 分类配置
const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: '日常生活', label: '日常生活' },
  { id: '文化历史', label: '文化历史' },
  { id: '历史演讲', label: '历史演讲' },
  { id: '艺术文化', label: '艺术文化' },
]

// 难度配置
const DIFFICULTIES = ['A1', 'A2', 'B1', 'B2']

// 难度颜色映射
const DIFFICULTY_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-200',
  A2: 'bg-blue-100 text-blue-700 border-blue-200',
  B1: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  B2: 'bg-red-100 text-red-700 border-red-200',
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 获取素材数据
  useEffect(() => {
    async function fetchMaterials() {
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .order('title')

        if (error) throw error
        setMaterials(data || [])
      } catch (error) {
        console.error('获取素材失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMaterials()
  }, [])

  // 过滤素材
  const filteredMaterials = materials.filter(material => {
    // 分类过滤
    if (selectedCategory !== 'all' && material.category !== selectedCategory) {
      return false
    }

    // 难度过滤
    if (selectedDifficulty && material.difficulty !== selectedDifficulty) {
      return false
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        material.title.toLowerCase().includes(query) ||
        material.category.toLowerCase().includes(query)
      )
    }

    return true
  })

  // 处理素材点击
  const handleMaterialClick = (material: Material) => {
    // TODO: 跳转到练习页面并加载该素材
    console.log('Selected material:', material)
    alert(`即将播放: ${material.title}\n\n此功能需要进一步实现跳转到练习页面并加载该素材。`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 返回主页链接 */}
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回练习
          </Link>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            English Dictation & Shadowing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            精选英语学习素材，涵盖日常生活、文化历史、历史演讲等多个主题。
            选择适合你难度的内容，开始练习吧！
          </p>

          {/* 统计信息 */}
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{materials.length}</span>
              <span>个素材</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{CATEGORIES.length - 1}</span>
              <span>个分类</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{DIFFICULTIES.length}</span>
              <span>个难度级别</span>
            </div>
          </div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* 分类 Tab */}
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* 搜索和难度过滤 */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 搜索框 */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="搜索素材标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 难度过滤 */}
            <div className="flex gap-2">
              {DIFFICULTIES.map(difficulty => (
                <button
                  key={difficulty}
                  onClick={() => setSelectedDifficulty(
                    selectedDifficulty === difficulty ? null : difficulty
                  )}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedDifficulty === difficulty
                      ? DIFFICULTY_COLORS[difficulty]
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {difficulty}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 素材列表 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">没有找到匹配的素材</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMaterials.map(material => (
              <MaterialCard
                key={material.id}
                material={material}
                onPlay={handleMaterialClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
