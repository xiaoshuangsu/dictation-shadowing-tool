/**
 * useUserVocabulary - 用户生词本管理 Hook
 *
 * 功能：
 * - 缓存用户的生词列表
 * - 提供检查单词是否已保存的函数
 * - 添加/删除单词后自动刷新缓存
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'

interface SavedWordsMap {
  [word: string]: boolean
}

export function useUserVocabulary() {
  const { user } = useAuth()
  const [savedWords, setSavedWords] = useState<SavedWordsMap>({})
  const [loading, setLoading] = useState(false)

  // 获取用户的生词列表
  const fetchVocabulary = useCallback(async () => {
    if (!user) {
      setSavedWords({})
      return
    }

    setLoading(true)
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
        setSavedWords(map)
      }
    } catch (error) {
      console.error('获取生词本失败:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // 检查单词是否已保存
  const isWordSaved = useCallback((word: string) => {
    const normalizedWord = word.toLowerCase().trim()
    return !!savedWords[normalizedWord]
  }, [savedWords])

  // 刷新生词本
  const refresh = useCallback(() => {
    fetchVocabulary()
  }, [fetchVocabulary])

  // 自动加载
  useEffect(() => {
    fetchVocabulary()
  }, [fetchVocabulary])

  return {
    savedWords,
    isWordSaved,
    refresh,
    loading
  }
}
