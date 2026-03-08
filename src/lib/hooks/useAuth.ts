/**
 * Authentication Hook (Supabase)
 *
 * Provides authentication state and methods (login, register, logout)
 * using Supabase Auth.
 *
 * V9 优化：
 * - 防止 INITIAL_SESSION 重复触发
 * - 防止重复 fetch profile（使用 profileFetchedRef）
 * - 延长超时到 20 秒，适应静态导出环境
 * - 简化初始化逻辑，只依赖 onAuthStateChange
 * - 确保监听器正确清理
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

  // 获取 profile 的函数（封装以便复用）
  const fetchProfile = useCallback(async (userId: string, email: string) => {
    // 如果已经获取过，直接返回 null
    if (profileFetchedRef.current) {
      console.log('Profile already fetched, skipping duplicate request')
      return null
    }

    console.log('Fetching user profile...')

    try {
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
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
      console.error('Failed to fetch profile:', error)
      profileFetchedRef.current = true // 即使失败也标记，避免重复尝试
      return null
    }
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true

    // 设置超时保护（20 秒）
    timeoutRef.current = setTimeout(() => {
      if (mounted && loading) {
        console.log('Auth initialization timeout (20s), setting loading to false')
        setLoading(false)
      }
    }, 20000)

    // 只依赖 onAuthStateChange，避免重复触发
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!mounted) return

        console.log('Auth state changed:', { event, hasSession: !!session, userId: session?.user?.id })

        // 清除超时计时器（任何 auth 事件都说明初始化已完成）
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }

        // 处理 INITIAL_SESSION（首次加载）
        if (event === 'INITIAL_SESSION') {
          if (initializedRef.current) {
            // 防止重复处理
            console.log('INITIAL_SESSION already handled, skipping')
            return
          }
          initializedRef.current = true
        }

        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session?.user)) {
          console.log('User signed in / INITIAL_SESSION with user')

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
          console.log('User signed out')
          setUser(null)
          // 重置标记，允许下次重新登录时获取
          profileFetchedRef.current = false
          setLoading(false)
        } else if (event === 'INITIAL_SESSION' && !session?.user) {
          // INITIAL_SESSION 但没有用户（未登录状态）
          console.log('INITIAL_SESSION: No user (not logged in)')
          initializedRef.current = true
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed')
          // TOKEN_REFRESHED 不需要重新获取 profile
        }
      }
    )

    return () => {
      console.log('Cleaning up auth subscription')
      mounted = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [loading, fetchProfile])

  const login = useCallback(async (email: string, password: string) => {
    try {
      console.log('Attempting login with:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        return {
          success: false,
          error: error.message || '登录失败，请检查邮箱和密码',
        }
      }

      console.log('Login successful')
      return { success: true }
    } catch (error: any) {
      console.error('Login exception:', error)
      return {
        success: false,
        error: error.message || '登录失败，请稍后重试',
      }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, username: string) => {
    try {
      console.log('Attempting to register:', { email, username })

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
        console.error('Supabase signUp error:', error)

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
      console.error('Register exception:', error)
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
