import type { Metadata } from "next"
import "./globals.css"
import Navigation from "@/components/Navigation"
import { LanguageProvider } from "@/contexts/LanguageContext"

export const metadata: Metadata = {
  title: "ShadowHub - English Dictation & Shadowing Practice",
  description: "Practice English listening and speaking with dictation and shadowing exercises. Get AI feedback and graded content for all levels.",
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
