import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

// 🔴 Supabase 配置
const SUPABASE_CONFIG = {
  url: 'https://cuxotlijjnxbsirpdkgr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'
}

// 辅助函数：生成 category slug
function categoryToSlug(category: string): string {
  const categoryMap: Record<string, string> = {
    '日常生活': 'daily-life',
    '历史文化': 'culture-history',
    '名人演讲': 'historical-speeches',
    '故事': 'stories',
    '对话': 'conversations',
    '新闻': 'news',
    // 添加更多映射...
  }
  return categoryMap[category] || 'daily-life'
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://shadowhub.app'
  const currentDate = new Date()

  try {
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key)

    // 获取所有激活的素材（过滤已下架的素材）
    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, slug, category, updated_at')
      .eq('is_active', true)
      .limit(1000)

    if (error) {
      console.error('Error fetching materials for sitemap:', error)
      // 返回基本 sitemap
      return [
        {
          url: baseUrl,
          lastModified: currentDate,
          changeFrequency: 'daily',
          priority: 1,
        },
      ]
    }

    // 构建素材页面 URL 列表
    const materialUrls: MetadataRoute.Sitemap = (materials || []).map((material) => {
      const categorySlug = categoryToSlug(material.category)
      const materialSlug = material.slug || material.id

      return {
        url: `${baseUrl}/topics/${categorySlug}/${materialSlug}`,
        lastModified: material.updated_at ? new Date(material.updated_at) : currentDate,
        changeFrequency: 'weekly',
        priority: 0.8,
      }
    })

    // 合并主要页面和素材页面
    return [
      // 首页
      {
        url: baseUrl,
        lastModified: currentDate,
        changeFrequency: 'daily',
        priority: 1,
      },
      // Topics 列表页
      {
        url: `${baseUrl}/topics`,
        lastModified: currentDate,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      // 词汇本页面
      {
        url: `${baseUrl}/vocabulary`,
        lastModified: currentDate,
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      // 个人中心页面
      {
        url: `${baseUrl}/profile`,
        lastModified: currentDate,
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      // 所有素材页面
      ...materialUrls,
    ]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return [
      {
        url: baseUrl,
        lastModified: currentDate,
        changeFrequency: 'daily',
        priority: 1,
      },
    ]
  }
}
