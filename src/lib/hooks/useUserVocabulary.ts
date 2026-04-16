/**
 * useUserVocabulary - 用户生词本管理 Hook
 *
 * 功能：
 * - 缓存用户的生词列表（全局单例）
 * - 提供检查单词是否已保存的函数
 * - 添加/删除单词后自动刷新缓存
 * - 🔴 性能优化：全局缓存，避免重复请求
 * - 🔥 V30.3.6: 添加请求锁，防止并发请求
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './useAuth'

interface SavedWordsMap {
  [word: string]: boolean
}

// 🔴 全局缓存：所有组件共享同一个生词本数据
let globalSavedWords: SavedWordsMap = {}
let globalLoading = false
let globalUser: string | null = null
let listeners: Set<() => void> = new Set()

// 🔥 V30.3.6: 请求锁，防止并发请求
let fetchPromise: Promise<void> | null = null
let isFetching = false  // 🔥 V30.3.6: 额外的布尔锁，确保原子性

// 🔴 通知所有监听器更新
const notifyListeners = () => {
  listeners.forEach(listener => listener())
}

export function useUserVocabulary() {
  const { user } = useAuth()
  const [savedWords, setSavedWords] = useState<SavedWordsMap>(globalSavedWords)
  const [loading, setLoading] = useState(globalLoading)
  const isMountedRef = useRef(false)  // 🔥 V30.3.6: 组件挂载标记

  // 获取用户的生词列表
  const fetchVocabulary = useCallback(async () => {
    if (!user) {
      globalSavedWords = {}
      globalUser = null
      notifyListeners()
      return
    }

    // 🔴 避免重复请求：如果用户未变化且有缓存，直接返回
    if (globalUser === user.id && Object.keys(globalSavedWords).length > 0) {
      setSavedWords({ ...globalSavedWords })
      return
    }

    // 🔥 V30.3.6: 如果已有请求在进行中，等待其完成
    if (isFetching || fetchPromise) {
      if (fetchPromise) {
        await fetchPromise
      }
      setSavedWords({ ...globalSavedWords })
      return
    }

    // 🔥 V30.3.6: 立即设置锁，防止并发
    isFetching = true
    globalLoading = true
    setLoading(true)

    // 🔥 V30.3.6: 创建新的请求 Promise
    fetchPromise = (async () => {
      try {
        const response = await fetch('/api/user-words', {
          headers: { 'Authorization': `Bearer ${user.id}` }
        })
        const data = await response.json()

        if (data.success && data.words) {
          const map: SavedWordsMap = {}
          data.words.forEach((w: any) => {
            map[w.word] = true
          })
          globalSavedWords = map
          globalUser = user.id
          notifyListeners()
          setSavedWords({ ...map })
        }
      } catch (error) {
        console.error('获取生词本失败:', error)
      } finally {
        globalLoading = false
        setLoading(false)
        isFetching = false  // 🔥 V30.3.6: 释放请求锁
        fetchPromise = null
      }
    })()

    await fetchPromise
  }, [user])

  // 检查单词是否已保存（同步函数，直接返回结果）
  const isWordSaved = useCallback((word: string) => {
    const normalizedWord = word.toLowerCase().trim()
    return !!globalSavedWords[normalizedWord]
  }, [])

  // 刷新生词本
  const refresh = useCallback(() => {
    fetchVocabulary()
  }, [fetchVocabulary])

  // 🔴 监听全局缓存变化
  useEffect(() => {
    const listener = () => {
      setSavedWords({ ...globalSavedWords })
      setLoading(globalLoading)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // 🔴 仅在组件挂载时加载一次（避免重复请求）
  useEffect(() => {
    isMountedRef.current = true

    // 如果还没有缓存数据，则加载
    if (Object.keys(globalSavedWords).length === 0 || globalUser !== user?.id) {
      fetchVocabulary()
    }

    return () => {
      isMountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return {
    savedWords,
    isWordSaved,
    refresh,
    loading
  }
}
