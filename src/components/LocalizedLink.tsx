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

  // 如果 href 是完整路径（包含 http），直接使用
  if (href.startsWith('http')) {
    return (
      <Link href={href} className={className} {...props}>
        {children}
      </Link>
    )
  }

  // 中文是默认/权威语言，不加前缀；英文加 /en 前缀
  // 注意：Next.js 的 basePath 配置会自动添加 /dictation-shadowing-tool，我们只需要处理语言前缀
  let finalHref = href

  if (language === "en") {
    // 英文添加 /en 前缀（如果还没有）
    if (!href.startsWith('/en') && !href.startsWith('#')) {
      finalHref = `/en${href === "/" ? "" : href}`
    }
  }

  return (
    <Link href={finalHref} className={className} {...props}>
      {children}
    </Link>
  )
}
