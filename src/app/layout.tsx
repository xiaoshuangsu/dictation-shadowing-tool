import type { Metadata } from "next"
import "./globals.css"
import Navigation from "@/components/Navigation"

export const metadata: Metadata = {
  title: "ShadowHub - English Dictation & Shadowing Practice",
  description: "Practice English listening and speaking with dictation and shadowing exercises",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Navigation />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  )
}
