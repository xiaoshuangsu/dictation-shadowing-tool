import { Suspense } from 'react'
import type { Metadata } from 'next'
import { MaterialsPageContent } from '../TopicsContent'

// 🔴 强制动态渲染：避免构建时查询数据库
export const dynamic = 'force-dynamic'

// 🔴 SEO 优化：Topics 列表页元数据
export const metadata: Metadata = {
  title: 'Explore English Practice Materials - ShadowHub Library',
  description: 'Browse our extensive collection of English dictation and shadowing materials across various categories.',
  alternates: {
    canonical: 'https://shadowhub.app/topics',
  },
  openGraph: {
    title: 'Explore English Practice Materials - ShadowHub Library',
    description: 'Browse our extensive collection of English dictation and shadowing materials across various categories.',
    url: 'https://shadowhub.app/topics',
    siteName: 'ShadowHub',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore English Practice Materials - ShadowHub Library',
    description: 'Browse our extensive collection of English dictation and shadowing materials across various categories.',
  },
}

// 🔴 服务端组件（默认导出）
export default function MaterialsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <MaterialsPageContent />
    </Suspense>
  )
}
