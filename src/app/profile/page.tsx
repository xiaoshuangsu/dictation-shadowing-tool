import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ProfilePageContent } from '../ProfileContent'

// 🔴 SEO 优化：Profile 个人中心元数据
// 注意：设置 robots: { index: false, follow: false } 防止搜索引擎索引用户的私人数据
export const metadata: Metadata = {
  title: 'My Profile & Learning Progress - ShadowHub',
  description: 'Manage your account settings and track your learning progress.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://shadowhub.app/profile',
  },
  openGraph: {
    title: 'My Profile & Learning Progress - ShadowHub',
    description: 'Manage your account settings and track your learning progress.',
    url: 'https://shadowhub.app/profile',
    siteName: 'ShadowHub',
    type: 'website',
  },
}

// 🔴 服务端组件（默认导出）
export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <ProfilePageContent />
    </Suspense>
  )
}
