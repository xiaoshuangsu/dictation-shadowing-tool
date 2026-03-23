import { Suspense } from 'react'
import type { Metadata } from 'next'
import HomeContent from './HomeContent'

// 🔴 SEO 优化：首页元数据
export const metadata: Metadata = {
  title: 'ShadowHub - Master English Speaking via Dictation & Shadowing',
  description: 'Improve your English pronunciation and listening skills with our interactive tools and real-world materials.',
  alternates: {
    canonical: 'https://shadowhub.app',
  },
  openGraph: {
    title: 'ShadowHub - Master English Speaking via Dictation & Shadowing',
    description: 'Improve your English pronunciation and listening skills with our interactive tools and real-world materials.',
    url: 'https://shadowhub.app',
    siteName: 'ShadowHub',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShadowHub - Master English Speaking via Dictation & Shadowing',
    description: 'Improve your English pronunciation and listening skills with our interactive tools and real-world materials.',
  },
}

// 🔴 服务端组件（默认导出）
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <HomeContent />
    </Suspense>
  )
}
