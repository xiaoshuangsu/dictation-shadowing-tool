import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import Navigation from "@/components/Navigation"
import { LanguageProvider } from "@/contexts/LanguageContext"

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
        <Script
          src="https://unpkg.com/vconsole@3.15.0/dist/vconsole.min.js"
          strategy="afterInteractive"
        />
        <Script id="vconsole-init" strategy="afterInteractive">
          {`if (typeof window !== 'undefined' && window.VConsole) {
            new window.VConsole({
              theme: 'dark',
            });
          }`}
        </Script>
        <LanguageProvider>
          <Navigation />
          <main className="pt-16">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  )
}
