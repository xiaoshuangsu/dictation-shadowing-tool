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

  // 在生产环境添加 basePath
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

  // 中文是默认/权威语言，不加前缀；英文加 /en 前缀
  let finalHref = href

  if (language === "en") {
    // 英文添加 /en 前缀（如果还没有）
    if (!href.startsWith('/en') && !href.startsWith('#')) {
      finalHref = `/en${href === "/" ? "" : href}`
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
