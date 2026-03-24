import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing Plans - ShadowHub | Unlock 1,000+ English Lessons",
  description: "Upgrade to ShadowHub Pro to unlock unlimited access to 1,000+ premium shadowing and dictation lessons. Ad-free experience with lifetime access available.",
  openGraph: {
    title: "Pricing Plans - ShadowHub | Unlock 1,000+ English Lessons",
    description: "Upgrade to ShadowHub Pro to unlock unlimited access to 1,000+ premium shadowing and dictation lessons. Ad-free experience with lifetime access available.",
    url: "https://shadowhub.app/pricing",
    siteName: "ShadowHub",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://shadowhub.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "ShadowHub - English Learning Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing Plans - ShadowHub | Unlock 1,000+ English Lessons",
    description: "Upgrade to ShadowHub Pro to unlock unlimited access to 1,000+ premium shadowing and dictation lessons. Ad-free experience with lifetime access available.",
    images: ["https://shadowhub.app/og-image.png"],
  },
  alternates: {
    canonical: "https://shadowhub.app/pricing",
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
