// Dynamic routes - generate static paths at build time
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'

// 🔴 关键修复：从共享配置导入凭证，避免重复定义
// TODO: 考虑将这些凭证移到 .env.local 或独立的配置文件
const SUPABASE_CONFIG = {
  url: 'https://cuxotlijjnxbsirpdkgr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'
}

// Generate static params with error handling
// 注意：这是服务端构建时函数，需要创建独立实例
export async function generateStaticParams() {
  try {
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key)

    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, title, category, slug')
      .limit(1000)

    if (error) {
      console.error('Error fetching materials:', error)
      return [{ category: 'daily-life', slug: 'placeholder' }]
    }

    // Generate routes using category slug and material slug
    // 优先使用数据库中存储的 slug，如果没有则从 title 生成
    return (materials || []).map((material) => ({
      category: categoryToSlug(material.category),
      slug: material.slug || titleToSlug(material.title),
    }))
  } catch (error) {
    console.error('Error in generateStaticParams:', error)
    return [{ category: 'daily-life', slug: 'placeholder' }]
  }
}

import PracticePage from './PracticePage'

export const dynamicParams = true

export default function Page({ params }: { params: { category: string; slug: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <PracticePage category={params.category} slug={params.slug} />
    </Suspense>
  )
}
