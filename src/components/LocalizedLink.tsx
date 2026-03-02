import Link from "next/link"
import { ReactNode } from "react"
import { useLanguage } from "@/contexts/LanguageContext"

interface LocalizedLinkProps {
  href: string
  children: ReactNode
  className?: string
  [key: string]: any
}

export default function LocalizedLink({ href, children, className, ...props }: LocalizedLinkProps) {
  const { language } = useLanguage()

  // 在生产环境添加 basePath，并处理语言前缀
  const isProd = process.env.NODE_ENV === 'production'
  const basePath = isProd ? '/dictation-shadowing-tool' : ''

  // 如果 href 是完整路径（包含 http），直接使用
  if (href.startsWith('http')) {
    return (
      <Link href={href} className={className} {...props}>
        {children}
      </Link>
    )
  }

  // 处理相对路径和 hash 链接
  const isZh = language === "zh"
  let finalHref = href

  if (isZh) {
    // 如果是中文且路径不包含 /zh-CN，添加语言前缀
    if (!href.includes('/zh-CN') && !href.startsWith('#')) {
      finalHref = `/zh-CN${href === "/" ? "" : href}`
    }
  }

  // 添加 basePath
  finalHref = `${basePath}${finalHref}`

  return (
    <Link href={finalHref} className={className} {...props}>
      {children}
    </Link>
  )
}
