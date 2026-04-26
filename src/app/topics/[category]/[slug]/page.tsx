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
import { notFound, permanentRedirect } from 'next/navigation'

// 🔴 强制动态渲染：避免构建时查询数据库
export const dynamic = 'force-dynamic'

// 🔴 关键修复：从共享配置导入凭证，避免重复定义
const SUPABASE_CONFIG = {
  url: 'https://cuxotlijjnxbsirpdkgr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'
}

/**
 * 🔥 v30.6.2: 服务端数据获取函数（带分类校验和下架检测）
 *
 * 在服务端获取素材的完整数据，避免客户端 CORS Preflight
 * 同时校验 URL 中的 category 是否与数据库中的素材分类匹配
 * 检测素材是否已下架（is_active = false），触发 301 重定向
 */
async function getMaterialData(materialSlug: string, urlCategory: string) {
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

    // 情况 A：素材不存在（已物理删除）
    if (!material) {
      return { status: 'not_found' }
    }

    // 情况 B：素材已下架（is_active = false）
    if (material.is_active === false) {
      return { status: 'inactive', material }
    }

    // 🔥 v30.6.1: 分类校验（防止软 404）
    // 将数据库中的 category 转换为 slug，与 URL 中的 category 对比
    const expectedCategorySlug = categoryToSlug(material.category).toLowerCase()
    const urlCategoryNormalized = urlCategory.toLowerCase()

    // 如果分类不匹配，返回 null（触发 404）
    if (expectedCategorySlug !== urlCategoryNormalized) {
      console.warn(`[MaterialDetailPage] Category mismatch: URL="${urlCategory}", DB="${material.category}" (slug="${expectedCategorySlug}")`)
      return { status: 'not_found' }
    }

    return { status: 'active', material }
  } catch (error) {
    console.error('[MaterialDetailPage] Error fetching material:', error)
    return { status: 'not_found' }
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

// 🔴 SEO 优化：动态生成元数据（带分类校验）
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

    // 🔥 v30.6.1: 使用数据库中的正确分类生成 canonical 链接
    // 而不是使用 URL 中的 category（可能是错误的）
    const correctCategorySlug = categoryToSlug(material.category)
    const canonicalUrl = `${baseUrl}/topics/${correctCategorySlug}/${params.slug}`

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
  // 🔥 v30.6.2: 在服务端获取完整数据，并校验分类匹配和下架状态
  const result = await getMaterialData(params.slug, params.category)

  // 情况 A & B：素材不存在或已下架 -> 301 重定向到分类页
  if (result.status === 'not_found' || result.status === 'inactive') {
    // 如果素材存在但已下架，使用其分类；否则使用 URL 中的分类
    const targetCategory = result.status === 'inactive' && result.material
      ? categoryToSlug(result.material.category)
      : params.category

    // 🔥 301 永久重定向到分类页
    permanentRedirect(`/topics/${targetCategory}`)
  }

  // 正常情况：素材存在且激活
  const material = result.material

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
