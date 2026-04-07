/**
 * Vocabulary Learning Hub - 学习中心看板
 *
 * V1.0 - 重构为学习中心
 * - Today Review: 今日到期单词
 * - Learning Progress: 学习进度统计
 * - Word Lists: 词库入口卡片
 */

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { VocabularyHubContent } from './VocabularyHubContent'

// SEO 元数据
export const metadata: Metadata = {
  title: 'Vocabulary Learning Hub - ShadowHub',
  description: 'Your personalized vocabulary learning center with spaced repetition system.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://shadowhub.app/vocabulary',
  },
  openGraph: {
    title: 'Vocabulary Learning Hub - ShadowHub',
    description: 'Your personalized vocabulary learning center with spaced repetition system.',
    url: 'https://shadowhub.app/vocabulary',
    siteName: 'ShadowHub',
    type: 'website',
  },
}

// 服务端组件（默认导出）
export default function VocabularyPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VocabularyHubContent />
    </Suspense>
  )
}

// Loading 骨架屏
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 h-48 animate-pulse"></div>
          <div className="bg-white rounded-lg shadow-sm p-6 h-48 animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}
