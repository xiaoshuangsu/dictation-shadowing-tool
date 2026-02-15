/**
 * Authentication Hook (Supabase)
 *
 * Provides authentication state and methods (login, register, logout)
 * using Supabase Auth.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
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

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true

    // Get current session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (mounted && session?.user) {
          // Fetch user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            username: profile?.username || session.user.email?.split('@')[0] || null,
            avatarUrl: profile?.avatar_url || null,
          })
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (session?.user) {
          // Fetch user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            username: profile?.username || session.user.email?.split('@')[0] || null,
            avatarUrl: profile?.avatar_url || null,
          })
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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
