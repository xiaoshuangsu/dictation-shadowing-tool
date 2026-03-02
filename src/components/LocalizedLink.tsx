import Link from "next/link"
import { ReactNode } from "react"

interface LocalizedLinkProps {
  href: string
  children: ReactNode
  className?: string
  [key: string]: any
}

export default function LocalizedLink({ href, children, className, ...props }: LocalizedLinkProps) {
  // 在生产环境添加 basePath
  const isProd = process.env.NODE_ENV === 'production'
  const basePath = isProd ? '/dictation-shadowing-tool' : ''

  return (
    <Link href={`${basePath}${href}`} className={className} {...props}>
      {children}
    </Link>
  )
}
