/**
 * Authentication Hook (Supabase)
 *
 * Provides authentication state and methods (login, register, logout)
 * using Supabase Auth.
 *
 * V10 优化（修复 React Error #310）：
 * - 移除 useCallback，避免依赖问题
 * - 直接在 useEffect 中定义函数
 * - 确保 Hook 顺序固定
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

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // 使用 ref 防止重复处理
  const initializedRef = useRef(false)
  const profileFetchedRef = useRef(false) // 防止重复 fetch profile
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true

    // 设置超时保护（20 秒）
    timeoutRef.current = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false)
      }
    }, 20000)

    // 获取 profile 的函数（直接定义在 effect 内部，避免依赖问题）
    const fetchProfile = async (userId: string, email: string) => {
      // 如果已经获取过，直接返回 null
      if (profileFetchedRef.current) {
        return null
      }

      try {
        // 🔥 V30.3.6: 数据瘦身 - 只查询必要的字段，不使用 select('*')
        const profilePromise = supabase
          .from('user_profiles')
          .select('id, username, avatar_url')  // 只查询必要字段
          .eq('id', userId)
          .single()

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: null }), 10000)
        )

        const data = await Promise.race([profilePromise, timeoutPromise]) as { data: any }
        const profile = data.data

        // 标记已获取
        profileFetchedRef.current = true

        return profile
      } catch (error) {
        console.error('[useAuth] Failed to fetch profile:', error)
        profileFetchedRef.current = true // 即使失败也标记，避免重复尝试
        return null
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

          // 只在首次时获取 profile
          const profile = await fetchProfile(session.user.id, session.user.email || '')

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            username: profile?.username || session.user.email?.split('@')[0] || null,
            avatarUrl: profile?.avatar_url || null,
          })

          // 签入后强制设置 loading 为 false
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          // 重置标记，允许下次重新登录时获取
          profileFetchedRef.current = false
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
