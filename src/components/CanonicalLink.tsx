/**
 * Canonical Link 组件
 * 动态生成规范网址标签，解决重复内容问题
 *
 * SEO 规则：
 * 1. 移除末尾斜杠
 * 2. 移除查询参数（如 ?mode=dictation）
 * 3. 使用统一的基础 URL
 */

'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface CanonicalLinkProps {
  baseUrl?: string
}

export function CanonicalLink({ baseUrl = 'https://shadowhub.app' }: CanonicalLinkProps) {
  const pathname = usePathname()

  useEffect(() => {
    // 移除末尾斜杠
    let canonicalPath = pathname.replace(/\/$/, '')

    // 确保根路径为空字符串（拼接后会得到 baseUrl）
    if (canonicalPath === '/') {
      canonicalPath = ''
    }

    // 构建规范 URL（不带查询参数）
    const canonicalUrl = canonicalPath
      ? `${baseUrl}${canonicalPath}`
      : baseUrl

    // 查找或创建 canonical link 标签
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement

    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }

    link.href = canonicalUrl
  }, [pathname, baseUrl])

  return null
}

/**
 * 服务端版本：生成 metadata alternates.canonical
 * 用于页面组件的 metadata 导出
 *
 * @example
 * ```ts
 * export const metadata: Metadata = {
 *   alternates: {
 *     canonical: buildCanonicalUrl('https://shadowhub.app/topics/daily-life/material-slug')
 *   }
 * }
 * ```
 */
export function buildCanonicalUrl(baseUrl: string, pathname?: string): string {
  // 移除末尾斜杠
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const cleanPathname = pathname?.replace(/\/$/, '') || ''

  // 构建规范 URL
  return cleanPathname
    ? `${cleanBaseUrl}${cleanPathname}`
    : cleanBaseUrl
}
