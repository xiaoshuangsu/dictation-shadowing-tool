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
    let isSubscribed = true
    let timeoutId: NodeJS.Timeout

    // Get current session
    const initializeAuth = async () => {
      if (!mounted || !isSubscribed) return

      try {
        console.log('Initializing auth state...')

        // Add timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          console.log('Auth initialization timeout, setting loading to false')
          if (mounted && isSubscribed) {
            setLoading(false)
          }
        }, 5000) // 5 second timeout

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        // Clear timeout on success
        if (timeoutId) clearTimeout(timeoutId)

        if (sessionError) {
          console.error('Session error:', sessionError)
        }

        console.log('Session from getSession():', session ? {
          hasUser: !!session.user,
          userId: session.user?.id,
          userEmail: session.user?.email,
        } : 'No session')

        if (mounted && isSubscribed && session?.user) {
          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profileError) {
            console.error('Profile fetch error:', profileError)
            // Still set user even if profile fetch fails
          }

          console.log('User profile:', profile)

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            username: profile?.username || session.user.email?.split('@')[0] || null,
            avatarUrl: profile?.avatar_url || null,
          })
        } else {
          console.log('No session found, user not logged in')
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
        // Ensure loading is set to false even on error
        if (timeoutId) clearTimeout(timeoutId)
      } finally {
        if (mounted && isSubscribed) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', { event, hasSession: !!session })

        if (!mounted || !isSubscribed) return

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
      isSubscribed = false
      if (timeoutId) clearTimeout(timeoutId)
      if (subscription) {
        subscription.unsubscribe()
      }
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

      // Debug logging
      console.log('Register result:', { data, error })
      console.log('Session after register:', data.session)

      // Check if session was created
      if (data.session) {
        console.log('Session created successfully, user should be logged in')
      } else {
        console.log('No session created - user may need to confirm email')
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
