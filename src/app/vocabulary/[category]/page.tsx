/**
 * Vocabulary Category Page - 动态分类列表页
 *
 * 支持的分类：
 * - my-words: 用户生词本
 * - oxford-3000: Oxford 3000 词库
 * - ielts: IELTS 词库（4141 词）
 * - daily-conversation: 日常会话（占位）
 * - business-english: 商务英语（占位）
 *
 * 功能：
 * - 虚拟滚动（处理大数据集）
 * - 单词卡片展示
 * - 音频播放
 */

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { VocabularyCategoryContent } from './VocabularyCategoryContent'

// SEO 元数据（动态生成）
export async function generateMetadata({ params }: { params: { category: string } }): Promise<Metadata> {
  const category = params.category
  const titles: Record<string, string> = {
    'my-words': 'My Words',
    'oxford-3000': 'Oxford 3000 Vocabulary',
    'ielts': 'IELTS Vocabulary',
    'daily-conversation': 'Daily Conversation',
    'business-english': 'Business English'
  }

  const title = titles[category] || 'Vocabulary'

  return {
    title: `${title} - ShadowHub`,
    description: `Browse and learn ${title.toLowerCase()} with our interactive vocabulary system.`,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${title} - ShadowHub`,
      description: `Browse and learn ${title.toLowerCase()} with our interactive vocabulary system.`,
      type: 'website',
    },
  }
}

// 服务端组件（默认导出）
export default function VocabularyCategoryPage({ params }: { params: { category: string } }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VocabularyCategoryContent category={params.category} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6 h-40 animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  )
}
