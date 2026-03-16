import type { Metadata } from "next"
import "./globals.css"
import Navigation from "@/components/Navigation"

export const metadata: Metadata = {
  title: "ShadowHub - English Dictation & Shadowing Practice",
  description: "Practice English listening and speaking with dictation and shadowing exercises. Get AI feedback and graded content for all levels.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navigation />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  )
}
