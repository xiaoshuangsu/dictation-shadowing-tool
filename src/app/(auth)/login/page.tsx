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
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  // Redirect to profile if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/profile')
    }
  }, [isAuthenticated, loading, router])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
            ShadowHub
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to save your practice records
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <LoginForm
            onSuccess={() => {
              // Redirect to home and reload to establish session
              // Check if in development or production
              const isDev = process.env.NODE_ENV === 'development'
              const baseUrl = isDev
                ? window.location.origin + '/'
                : window.location.origin + '/dictation-shadowing-tool/'
              window.location.href = baseUrl
            }}
          />

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?
            <Link
              href="/register"
              className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign up now
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
