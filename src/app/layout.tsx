import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "英语听写 & 影子跟读工具",
  description: "英语听写与影子跟读练习工具 V0",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
