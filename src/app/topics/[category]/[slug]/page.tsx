/**
 * Material Detail Page - 服务端组件（v30.4.2 修复）
 *
 * ✅ 重构目标：
 * - 服务端预取数据：消除客户端 CORS Preflight 延迟
 * - 全量字段查询：确保练习页面获取所有必要数据（transcript, audio_path 等）
 * - 数据通过 Props 传递：客户端组件不再发起 Supabase 请求
 */

import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { titleToSlug } from '@/lib/utils/slug'
import { categoryToSlug } from '@/lib/utils/category'
import type { Metadata } from 'next'
import PracticePage from './PracticePage'

// 🔴 强制动态渲染：避免构建时查询数据库
export const dynamic = 'force-dynamic'

// 🔴 关键修复：从共享配置导入凭证，避免重复定义
const SUPABASE_CONFIG = {
  url: 'https://cuxotlijjnxbsirpdkgr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'
}

/**
 * 🔥 v30.4.2: 服务端数据获取函数
 *
 * 在服务端获取素材的完整数据，避免客户端 CORS Preflight
 */
async function getMaterialData(materialSlug: string) {
  const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key)

  try {
    // 🔥 查询全量字段 - 确保练习页面有所有必要数据
    const { data: material, error } = await supabase
      .from('materials')
      .select('*')
      .eq('slug', materialSlug)
      .single()

    if (error) {
      throw error
    }

    return material
  } catch (error) {
    console.error('[MaterialDetailPage] Error fetching material:', error)
    return null
  }
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

export const dynamicParams = true

export default async function Page({ params }: { params: { category: string; slug: string } }) {
  // 🔥 v30.4.2: 在服务端获取完整数据，避免客户端 CORS Preflight
  const material = await getMaterialData(params.slug)

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading material...</p>
        </div>
      </div>
    }>
      <PracticePage
        category={params.category}
        slug={params.slug}
        initialMaterial={material}
      />
    </Suspense>
  )
}
