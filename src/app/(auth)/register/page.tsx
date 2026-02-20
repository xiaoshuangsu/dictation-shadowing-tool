/**
 * Registration Page
 *
 * User registration page with sign-up form.
 * Redirects to home page after successful registration.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import RegisterForm from '@/components/auth/RegisterForm'
import Link from 'next/link'

export default function RegisterPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [manualRedirect, setManualRedirect] = useState(false)

  // Redirect to profile if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated && !manualRedirect) {
      console.log('User authenticated, redirecting to profile...')
      setManualRedirect(true)
      router.push('/profile')
    }
  }, [isAuthenticated, loading, router, manualRedirect])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            听力练习工具
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            注册后需要登录账号以保存练习记录
          </p>
        </div>

        {/* Register Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <RegisterForm
            onSuccess={() => {
              // Redirect to home
              const isDev = process.env.NODE_ENV === 'development'
              const baseUrl = isDev
                ? window.location.origin + '/'
                : window.location.origin + '/dictation-shadowing-tool/'
              window.location.href = baseUrl
            }}
          />

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            已有账号？
            <Link
              href="/login"
              className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              立即登录
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}
