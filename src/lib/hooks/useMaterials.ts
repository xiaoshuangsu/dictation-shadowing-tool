/**
 * useMaterials - 使用 SWR 管理素材数据
 *
 * 优化目标：
 * - 瞬时加载：从缓存立即展示数据，避免白屏闪烁
 * - 禁用自动重新验证：切换标签时不重新请求
 * - 保持数据新鲜度：手动控制何时刷新
 * - 与 Vocabulary 页面保持一致的缓存策略
 */

'use client'

import useSWR, { SWRConfiguration } from 'swr'
import { getSupabase } from '@/lib/supabase/client'

export interface Material {
  id: string
  title: string
  category: string
  difficulty: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  audio_path: string
  thumbnail_path: string | null
  audio_size: number
  duration: number | null
  play_count: number
  slug?: string
}

export interface MaterialsByCategory {
  [categoryId: string]: Material[]
}

export interface CategoryCounts {
  [categoryId: string]: number
}

export interface MaterialsResponse {
  materialsByCategory: MaterialsByCategory
  categoryCounts: CategoryCounts
}

// 分类列表
export const CATEGORIES = [
  { id: '日常生活', label: 'Daily Life' },
  { id: 'Science and Facts', label: 'Science and Facts' },
  { id: 'BBC Earth', label: 'BBC Earth' },
  { id: '历史演讲', label: 'Historical Speeches' },
  { id: 'TED演讲', label: 'TED Talks' },
  { id: '文化历史', label: 'Culture & History' },
  { id: '心灵故事', label: 'Heart & Soul Stories' },
  { id: '艺术文化', label: 'Arts & Culture' },
  { id: '故事', label: 'Stories' },
  { id: '动画片', label: 'Cartoons' },
  { id: '人物访谈', label: 'Interviews' },
  { id: 'BBC Learning English', label: 'BBC Learning English' },
  { id: 'VOA Learning English', label: 'VOA Learning English' },
  { id: 'IELTS Listening', label: 'IELTS Listening' },
] as const

/**
 * SWR 配置：优化性能 - 与 useUserWords 保持一致的配置
 * 🔥 V30.3.8: 增加缓存时间至 5 分钟，减少请求频率
 */
const swrConfig: SWRConfiguration = {
  // 🔴 关键优化：完全禁用自动重新验证
  revalidateIfStale: false,       // 即使数据过期也不重新验证
  revalidateOnFocus: false,       // 切换标签时不重新请求
  revalidateOnReconnect: false,   // 网络重连时不重新请求

  // 🔥 V30.3.8: 5分钟缓存，避免频繁请求
  dedupingInterval: 300000,       // 5分钟（减少数据库压力）

  // 🔴 加载状态优化
  keepPreviousData: true,         // 请求期间保留旧数据（避免白屏）

  // 🔴 错误处理
  shouldRetryOnError: true,       // 出错时自动重试
  errorRetryCount: 3,             // 重试次数
  errorRetryInterval: 5000,       // 重试间隔（5秒）
}

/**
 * Fetcher 函数：获取所有分类的素材
 * 🔥 V30.3.8: 优化查询 - 从 28 个独立查询聚合为 2 个查询（解决 N+1 问题）
 */
async function fetchMaterials(): Promise<MaterialsResponse> {
  const supabaseClient = getSupabase()
  const DEFAULT_COVER = 'thumbnails/culture-history-cover.jpg'

  const result: MaterialsByCategory = {}
  const counts: CategoryCounts = {}

  // 🔥 V30.3.8: 第一步 - 一次性查询所有分类的素材（每个分类最多 4-50 个）
  // 使用 IN 查询，在应用层过滤分类
  const { data: allMaterials } = await supabaseClient
    .from('materials')
    .select('id, title, category, difficulty, thumbnail_path, slug')  // 🔥 只查询必要字段，禁止 transcript
    .in('category', CATEGORIES.map(c => c.id))
    .order('category, title')

  // 🔥 V30.3.8: 第二步 - 一次性查询所有分类的数量
  const { data: allCounts } = await supabaseClient
    .from('materials')
    .select('category', { count: 'exact', head: true })
    .in('category', CATEGORIES.map(c => c.id))

  // 🔥 处理素材数据
  if (allMaterials) {
    // 按分类分组
    const materialsByCategoryMap: Record<string, any[]> = {}
    CATEGORIES.forEach(category => {
      materialsByCategoryMap[category.id] = []
    })

    allMaterials.forEach(material => {
      if (materialsByCategoryMap[material.category]) {
        materialsByCategoryMap[material.category].push(material)
      }
    })

    // 处理每个分类的素材
    CATEGORIES.forEach(category => {
      const materials = materialsByCategoryMap[category.id] || []

      if (category.id === '日常生活') {
        // 对于 Daily Life，优先显示有自定义封面的素材
        const customCoverMaterials = materials.filter(m =>
          m.thumbnail_path && m.thumbnail_path !== DEFAULT_COVER
        )
        const defaultCoverMaterials = materials.filter(m =>
          !m.thumbnail_path || m.thumbnail_path === DEFAULT_COVER
        )
        // 合并：自定义封面在前，默认封面在后，各取前几个
        const customMaterials = customCoverMaterials.slice(0, 4)
        const remainingCount = 4 - customMaterials.length
        const defaultMaterials = defaultCoverMaterials.slice(0, remainingCount)
        result[category.id] = [...customMaterials, ...defaultMaterials] as Material[]
      } else {
        result[category.id] = materials.slice(0, 4) as Material[]
      }
    })
  }

  // 🔥 处理计数数据
  if (allCounts) {
    allCounts.forEach(item => {
      counts[item.category] = item.count
    })
  }

  return {
    materialsByCategory: result,
    categoryCounts: counts
  }
}

/**
 * Hook: 获取所有分类的素材数据
 *
 * @returns SWR 响应对象
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useMaterials()
 *
 * const materialsByCategory = data?.materialsByCategory || {}
 * const categoryCounts = data?.categoryCounts || {}
 * ```
 */
export function useMaterials() {
  // 🔴 使用 SWR 管理数据请求
  const swrResponse = useSWR<MaterialsResponse>(
    'materials-all-categories',  // 🔴 使用固定的 cache key
    fetchMaterials,
    swrConfig  // 使用全局配置，已设置 revalidateIfStale: false
  )

  return {
    ...swrResponse,
    // 🔴 提供便捷的数据访问
    materialsByCategory: swrResponse.data?.materialsByCategory || {},
    categoryCounts: swrResponse.data?.categoryCounts || {},
  }
}
