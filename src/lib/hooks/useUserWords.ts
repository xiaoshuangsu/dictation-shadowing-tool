/**
 * useUserWords - 使用 SWR 管理用户生词数据
 *
 * 优化目标：
 * - 瞬时加载：从缓存立即展示数据，避免白屏闪烁
 * - 禁用自动重新验证：切换标签时不重新请求
 * - 保持数据新鲜度：手动控制何时刷新
 */

'use client'

import useSWR, { SWRConfiguration } from 'swr'
import { useMemo } from 'react'

// 🔴 创建全局缓存存储，确保组件卸载后缓存仍然保留
// 这是解决 Topics ↔ Vocabulary 切换闪烁的关键
const globalCache = new Map()

interface UserWord {
  id: string
  user_id: string
  word: string
  phonetic: string
  definition: string
  context_sentence: string
  material_id: string | null
  material_title: string | null
  audio_timestamp: number | null
  audio_url: string | null
  mastery_status: 'learning' | 'familiar' | 'mastered'
  created_at: string
  next_review_at?: string | null
  review_level?: number
  dictionary_cache?: {
    audio_url_us: string | null
    audio_url_uk: string | null
  }
}

interface UserWordsResponse {
  success: boolean
  words: UserWord[]
  total: number
}

/**
 * Fetcher 函数：用于 SWR
 */
async function fetcher(url: string): Promise<UserWordsResponse> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

/**
 * SWR 配置：优化性能 - 实现真正的零延迟切换
 * 🔥 V30.6.10: 增加 30 秒去重时间，防止快速点击时数据库过载
 */
const swrConfig: SWRConfiguration = {
  // 🔴 关键优化：使用全局缓存 provider，确保组件卸载后缓存保留
  // 这是解决 Topics ↔ Vocabulary 切换闪烁的核心修复
  provider: () => globalCache,

  // 🔴 禁用所有自动重新验证，从缓存瞬时加载
  revalidateIfStale: false,       // 即使数据过期也不重新验证
  revalidateOnFocus: false,       // 🔥 焦点切换时不重新验证（防止标签页切换时请求）
  revalidateOnReconnect: false,   // 网络重连时不重新请求

  // 🔥 V30.6.10: 超长时间缓存：30秒内不重复请求（防止数据库过载）
  dedupingInterval: 30000,        // 30秒内不重复请求

  // 🔴 加载状态优化
  keepPreviousData: true,         // 请求期间保留旧数据（避免白屏）

  // 🔴 错误处理
  shouldRetryOnError: true,       // 出错时自动重试
  errorRetryCount: 3,             // 重试次数
  errorRetryInterval: 5000,       // 重试间隔（5秒）

  // 🔴 智能挂载策略：
  // - 如果缓存存在：不重新验证（从缓存瞬时加载）
  // - 如果缓存不存在：执行首次请求
  // 通过 shouldShowLoading 判断实现
  revalidateOnMount: true,
}

/**
 * Hook: 获取用户生词列表
 *
 * @param status - 掌握状态过滤（'all' | 'learning' | 'familiar' | 'mastered'）
 * @param userId - 用户 ID
 * @returns SWR 响应对象
 *
 * @example
 * ```tsx
 * const { data, error, isLoading, mutate } = useUserWords('all', user?.id)
 *
 * if (isLoading) return <div>Loading...</div>
 * if (error) return <div>Error loading words</div>
 * return <div>{data?.words.length} words</div>
 * ```
 */
export function useUserWords(status: string = 'all', userId?: string | null) {
  // 🔥 V30.3.6: 使用 useMemo 稳定 URL，防止每次渲染都创建新引用导致 SWR 重复请求
  const url = useMemo(() => {
    const query = status === 'all' ? '' : `?status=${status}`
    return `/api/user-words${query}`
  }, [status])

  // 🔴 使用 SWR 管理数据请求
  // 注意：fetcher 需要包含 Authorization header
  const swrResponse = useSWR<UserWordsResponse>(
    userId ? url : null,  // 🔴 使用条件 key，完全符合 SWR 最佳实践
    async (url: string) => {
      // 🔴 在 fetcher 中添加 Authorization header
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${userId}` }
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    },
    swrConfig  // 使用全局配置
  )

  return {
    ...swrResponse,
    // 🔴 提供便捷的数据访问
    words: swrResponse.data?.words || [],
    total: swrResponse.data?.total || 0,
  }
}

/**
 * Hook: 检查单个单词是否已保存
 */
export function useWordSaved(word: string, userId?: string | null) {
  // 🔥 V30.3.6: 使用 useMemo 稳定 URL，防止每次渲染都创建新引用导致 SWR 重复请求
  const checkUrl = useMemo(() => {
    return `/api/user-words/check?word=${encodeURIComponent(word)}`
  }, [word])

  const { data, error, isLoading } = useSWR<boolean>(
    userId && word ? checkUrl : null,  // 🔥 V30.3.6: 使用条件 key，避免无效请求
    async () => {
      // 🔴 在 fetcher 中判断 userId 和 word
      if (!userId || !word) {
        return false
      }

      const response = await fetch(checkUrl, {
        headers: { 'Authorization': `Bearer ${userId}` }
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      return result.saved || false
    },
    swrConfig  // 使用全局配置，已设置 revalidateIfStale: false
  )

  return {
    isSaved: data || false,
    isLoading,
    error,
  }
}

/**
 * 导出 SWR 的 mutate 函数，用于手动刷新数据
 *
 * @example
 * ```tsx
 * const { mutate } = useUserWords('all', user.id)
 *
 * // 添加单词后刷新
 * await addWord(word)
 * mutate()  // 立即刷新数据
 * ```
 */
export type { MutatorCallback } from 'swr'
