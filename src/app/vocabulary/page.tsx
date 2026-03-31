import { Suspense } from 'react'
import type { Metadata } from 'next'
import { VocabularyPageContent } from '../VocabularyContent'

// 🔴 SEO 优化：Vocabulary 生词本元数据
// ✅ 允许搜索引擎索引（修改为 index, follow）
export const metadata: Metadata = {
  title: 'My Vocabulary & Spaced Repetition - ShadowHub',
  description: 'Review your saved words and phrases with our intelligent spaced repetition system.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://shadowhub.app/vocabulary',
  },
  openGraph: {
    title: 'My Vocabulary & Spaced Repetition - ShadowHub',
    description: 'Review your saved words and phrases with our intelligent spaced repetition system.',
    url: 'https://shadowhub.app/vocabulary',
    siteName: 'ShadowHub',
    type: 'website',
  },
}

// 🔴 服务端组件（默认导出）
export default function VocabularyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <VocabularyPageContent />
    </Suspense>
  )
}
