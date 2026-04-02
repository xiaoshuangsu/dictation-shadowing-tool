// Dynamic routes - generate static paths at build time
import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'
import type { Metadata } from 'next'

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

// 🔴 SEO 优化：动态生成元数据
export async function generateMetadata(
  { params }: { params: { category: string; slug: string } }
): Promise<Metadata> {
  try {
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key)

    // 通过 slug 查询素材
    const { data: material, error } = await supabase
      .from('materials')
      .select('title, slug, category, thumbnail_path, og_image')
      .eq('slug', params.slug)
      .single()

    if (error || !material) {
      // 如果查询失败，返回默认元数据
      return {
        title: 'English Practice Material - ShadowHub',
        description: 'Practice English with interactive dictation and shadowing materials on ShadowHub.',
      }
    }

    // 构建基础 URL（不带参数）
    const baseUrl = 'https://shadowhub.app'
    const canonicalUrl = `${baseUrl}/topics/${params.category}/${params.slug}`

    // 动态生成 Title 和 Description
    const title = `${material.title} - ShadowHub Dictation & Shadowing Material`
    const description = `Practice English with "${material.title}". Improve your pronunciation and speaking skills with our interactive dictation and shadowing materials.`

    // 获取缩略图 URL（优先使用 og_image，否则使用 thumbnail_path）
    const imageUrl = material.og_image || material.thumbnail_path || `${baseUrl}/og-image.png`

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        siteName: 'ShadowHub',
        type: 'website',
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: material.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'English Practice Material - ShadowHub',
      description: 'Practice English with interactive dictation and shadowing materials on ShadowHub.',
    }
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
