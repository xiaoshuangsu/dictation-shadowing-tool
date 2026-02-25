import Link from "next/link"
import { ReactNode } from "react"

interface LocalizedLinkProps {
  href: string
  children: ReactNode
  className?: string
  [key: string]: any
}

export default function LocalizedLink({ href, children, className, ...props }: LocalizedLinkProps) {
  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  )
}
