/**
 * Registration Form Component
 *
 * Provides user registration form with email, username, and password fields.
 * Includes validation and error handling using the useAuth hook.
 */

'use client'

import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

interface RegisterFormProps {
  onSuccess?: () => void
}

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    console.log('Register form submitted:', { email, username })

    // Basic validation
    if (!email || !username || !password || !confirmPassword) {
      setError('请填写所有字段')
      return
    }

    if (!email.includes('@')) {
      setError('请输入有效的邮箱地址')
      return
    }

    if (username.length < 3) {
      setError('用户名至少需要 3 个字符')
      return
    }

    if (password.length < 6) {
      setError('密码至少需要 6 个字符')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)

    try {
      console.log('Calling register function...')
      const result = await register(email, password, username)

      console.log('Register result:', result)

      if (!result || !result.success) {
        console.error('Registration failed:', result?.error)
        setError(result?.error || '注册失败')
        setLoading(false)
      } else {
        console.log('Registration successful, redirecting to home...')
        setLoading(false)
        // Redirect to home page with full URL
        const baseUrl = window.location.origin + '/dictation-shadowing-tool/'
        window.location.href = baseUrl
      }
    } catch (err) {
      console.error('Register exception:', err)
      setError('注册失败，请稍后重试')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">
            邮箱
          </label>
          <input
            id="register-email"
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

        {/* Username Input */}
        <div>
          <label htmlFor="register-username" className="block text-sm font-medium text-gray-700 mb-1">
            用户名
          </label>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            placeholder="请输入用户名"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="username"
            required
          />
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">
            密码
          </label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="至少 6 个字符"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="new-password"
            required
          />
        </div>

        {/* Confirm Password Input */}
        <div>
          <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
            确认密码
          </label>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            placeholder="再次输入密码"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="new-password"
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
          {loading ? '注册中...' : '注册'}
        </button>
      </form>
    </div>
  )
}
