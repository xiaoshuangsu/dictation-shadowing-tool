/**
 * Login Page
 *
 * User authentication page with login form.
 * Redirects to home page after successful login.
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  // Redirect to home if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            听力练习工具
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            登录以保存您的练习记录
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <LoginForm
            onSuccess={() => router.push('/')}
          />

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            还没有账号？
            <Link
              href="/register"
              className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              立即注册
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
