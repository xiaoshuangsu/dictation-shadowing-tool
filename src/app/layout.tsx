import type { Metadata } from "next"
import "./globals.css"
import Navigation from "@/components/Navigation"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { cookies } from "next/headers"

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const language = cookieStore.get('language')?.value || 'en'

  if (language === 'zh') {
    return {
      title: "ShadowHub - 英语听写和影子跟读练习工具",
      description: "通过听写和跟读练习，提升您的英语听力和口语技能。获取AI反馈和分级内容，适合所有水平的英语学习者。",
    }
  }

  return {
    title: "ShadowHub - English Dictation & Shadowing Practice",
    description: "Practice English listening and speaking with dictation and shadowing exercises. Get AI feedback and graded content for all levels.",
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LanguageProvider>
          <Navigation />
          <main className="pt-16">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  )
}
