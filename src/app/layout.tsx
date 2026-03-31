import type { Metadata } from "next"
import "./globals.css"
import Navigation from "@/components/Navigation"
import { CanonicalLink } from "@/components/CanonicalLink"

export const metadata: Metadata = {
  title: "ShadowHub - English Dictation & Shadowing Practice",
  description: "Practice English listening and speaking with dictation and shadowing exercises. Get AI feedback and graded content for all levels.",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* 🔴 SEO: 动态 Canonical Tag */}
        <CanonicalLink />

        <Navigation />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  )
}
