/**
 * Auth Button Component
 *
 * Displays login/logout button based on authentication state.
 * Shows user menu when logged in.
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function AuthButton() {
  const { user, isAuthenticated, logout, loading } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const router = useRouter()

  // Debug logging
  useEffect(() => {
    console.log('AuthButton state:', {
      loading,
      isAuthenticated,
      user: user ? { id: user.id, username: user.username } : null,
    })
  }, [loading, isAuthenticated, user])

  const handleLogout = async () => {
    await logout()
    setShowMenu(false)
    router.push('/')
  }

  const navigateToProfile = () => {
    setShowMenu(false)
    router.push('/profile')
  }

  if (loading) {
    return (
      <div className="h-10 w-20 bg-gray-200 animate-pulse rounded-lg" />
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
        >
          Login
        </button>
        <button
          onClick={() => router.push('/register')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          Sign Up
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* User Avatar/Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <span className="text-sm font-medium text-gray-700">
          {user?.username || 'User'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={navigateToProfile}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Profile
            </button>

            <hr className="my-1" />

            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  )
}
