import Link from "next/link"
import { useLanguage } from "@/contexts/LanguageContext"
import { ReactNode } from "react"

interface LocalizedLinkProps {
  href: string
  children: ReactNode
  className?: string
  [key: string]: any
}

export default function LocalizedLink({ href, children, className, ...props }: LocalizedLinkProps) {
  const { language } = useLanguage()

  const localizedHref =
    language === "zh" ? `/zh-CN${href === "/" ? "" : href}` : href

  return (
    <Link href={localizedHref} className={className} {...props}>
      {children}
    </Link>
  )
}
