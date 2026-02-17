/**
 * Login Form Component
 *
 * Provides email/password login form with validation and error handling.
 * Uses the useAuth hook for authentication logic.
 */

'use client'

import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

interface LoginFormProps {
  onSuccess?: () => void
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    console.log('Login form submitted with email:', email)

    // Basic validation
    if (!email || !password) {
      setError('请填写邮箱和密码')
      return
    }

    if (!email.includes('@')) {
      setError('请输入有效的邮箱地址')
      return
    }

    setLoading(true)

    try {
      console.log('Calling login function...')
      const result = await login(email, password)

      console.log('Login result:', result)

      if (!result.success) {
        console.error('Login failed:', result.error)
        setError(result.error || '登录失败')
        setLoading(false)
      } else {
        console.log('Login successful, waiting 500ms before redirect')
        // Login successful - wait a moment for session to be set
        setLoading(false)
        // Delay to allow auth state to update
        setTimeout(() => {
          console.log('Calling onSuccess callback')
          onSuccess?.()
        }, 500)
      }
    } catch (err) {
      console.error('Login exception:', err)
      setError('登录失败，请稍后重试')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="your@email.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="email"
            required
          />
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="current-password"
            required
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
