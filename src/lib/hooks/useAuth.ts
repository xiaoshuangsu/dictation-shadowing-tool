/**
 * Authentication Hook (Supabase)
 *
 * Provides authentication state and methods (login, register, logout)
 * using Supabase Auth.
 *
 * V11 优化（修复 user_profiles 请求风暴）：
 * - 将 profile 数据改为全局单例，防止多组件重复请求
 * - 添加全局请求锁，确保所有组件共享同一个 profile
 * - 添加 10 分钟缓存，彻底解决重复请求问题
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface AuthUser {
  id: string
  email: string
  username: string | null
  avatarUrl: string | null
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

// 🔥 V30.3.6: 全局单例 - 防止多组件重复请求
let globalProfile: { username: string | null; avatarUrl: string | null } | null = null
let globalProfileFetched = false  // 全局标记，所有组件共享
let globalProfileFetching = false  // 全局请求锁
let profileListeners: Set<(user: AuthUser | null) => void> = new Set()

// 通知所有监听器
const notifyProfileListeners = (user: AuthUser | null) => {
  profileListeners.forEach(listener => listener(user))
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // 使用 ref 防止重复处理
  const initializedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(false)  // 🔥 V30.3.6: 组件挂载标记

  // 🔥 V30.3.6: 监听全局 profile 变化
  useEffect(() => {
    isMountedRef.current = true

    const listener = (globalUser: AuthUser | null) => {
      if (isMountedRef.current) {
        setUser(globalUser)
      }
    }

    profileListeners.add(listener)

    // 如果已有全局数据，立即同步
    if (globalProfile || user) {
      const existingUser = user
      if (existingUser) {
        setUser(existingUser)
      }
    }

    return () => {
      isMountedRef.current = false
      profileListeners.delete(listener)
    }
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true

    // 设置超时保护（20 秒）
    timeoutRef.current = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false)
      }
    }, 20000)

    // 🔥 V30.3.6: 全局 fetchProfile - 使用全局单例防止重复请求
    const fetchProfile = async (userId: string, email: string) => {
      // 如果已经获取过，直接返回全局缓存
      if (globalProfileFetched) {
        return globalProfile
      }

      // 如果已有请求在进行中，等待其完成
      if (globalProfileFetching) {
        // 等待最多 5 秒
        const maxWait = 50
        let waited = 0
        while (globalProfileFetching && waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100))
          waited++
        }
        return globalProfile
      }

      // 立即设置请求锁
      globalProfileFetching = true

      try {
        // 数据瘦身 - 只查询必要字段
        const profilePromise = supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .eq('id', userId)
          .single()

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: null }), 10000)
        )

        const data = await Promise.race([profilePromise, timeoutPromise]) as { data: any }
        const profile = data.data

        // 保存到全局缓存
        globalProfile = profile
        globalProfileFetched = true

        return profile
      } catch (error) {
        console.error('[useAuth] Failed to fetch profile:', error)
        globalProfileFetched = true // 即使失败也标记，避免重复尝试
        return null
      } finally {
        globalProfileFetching = false  // 释放请求锁
      }
    }

    // 只依赖 onAuthStateChange，避免重复触发
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!mounted) return

        // 清除超时计时器（任何 auth 事件都说明初始化已完成）
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }

        // 处理 INITIAL_SESSION（首次加载）
        if (event === 'INITIAL_SESSION') {
          if (initializedRef.current) {
            // 防止重复处理
            return
          }
          initializedRef.current = true
        }

        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session?.user)) {
          // 🔥 V30.3.6: 使用全局 fetchProfile
          const profile = await fetchProfile(session.user.id, session.user.email || '')

          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            username: profile?.username || session.user.email?.split('@')[0] || null,
            avatarUrl: profile?.avatar_url || null,
          }

          setUser(authUser)
          // 🔥 V30.3.6: 通知所有监听器
          notifyProfileListeners(authUser)

          // 签入后强制设置 loading 为 false
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          // 🔥 V30.3.6: 重置全局状态
          globalProfile = null
          globalProfileFetched = false
          notifyProfileListeners(null)
          setLoading(false)
        } else if (event === 'INITIAL_SESSION' && !session?.user) {
          // INITIAL_SESSION 但没有用户（未登录状态）
          initializedRef.current = true
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (subscription) {
        subscription.unsubscribe()
      }
    }
    // 🔴 空依赖数组：effect 只在组件挂载时运行一次
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return {
          success: false,
          error: error.message || '登录失败，请检查邮箱和密码',
        }
      }

      return { success: true }
    } catch (error: any) {
      console.error('[useAuth] Login exception:', error)
      return {
        success: false,
        error: error.message || '登录失败，请稍后重试',
      }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, username: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      })

      if (error) {
        let errorMessage = '注册失败，请稍后重试'

        if (error.message.includes('User already registered')) {
          errorMessage = '该邮箱已被注册'
        } else if (error.message.includes('Invalid email')) {
          errorMessage = '邮箱地址无效'
        } else if (error.message) {
          errorMessage = error.message
        }

        return { success: false, error: errorMessage }
      }

      return { success: true }
    } catch (error: any) {
      console.error('[useAuth] Register exception:', error)
      return {
        success: false,
        error: error.message || '注册失败，请稍后重试',
      }
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  }
}
