import Hero from "@/components/landing/Hero"
import HowItWorks from "@/components/landing/HowItWorks"
import FeaturesTitle from "@/components/landing/FeaturesTitle"
import FeatureDictation from "@/components/landing/FeatureDictation"
import FeatureShadowing from "@/components/landing/FeatureShadowing"
import FeatureAI from "@/components/landing/FeatureAI"
import FeatureGrowth from "@/components/landing/FeatureGrowth"
import FAQ from "@/components/landing/FAQ"
import CTA from "@/components/landing/CTA"
import Link from "next/link"

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <Hero />

      {/* How It Works */}
      <HowItWorks />

      {/* Features Section Title */}
      <FeaturesTitle />

      {/* Feature: Dictation */}
      <FeatureDictation />

      {/* Feature: Shadowing */}
      <FeatureShadowing />

      {/* Feature: AI */}
      <FeatureAI />

      {/* Feature: Growth */}
      <FeatureGrowth />

      {/* FAQ */}
      <FAQ />

      {/* CTA */}
      <CTA />

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-semibold mb-4">About</h3>
              <p className="text-sm leading-relaxed">
                A professional English dictation and shadowing practice tool to help you efficiently improve your listening and speaking skills.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Features</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/practice" className="hover:text-white transition-colors">Dictation Practice</Link></li>
                <li><Link href="/practice" className="hover:text-white transition-colors">Shadowing Practice</Link></li>
                <li><Link href="/topics" className="hover:text-white transition-colors">Materials</Link></li>
                <li><Link href="/profile" className="hover:text-white transition-colors">Profile</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/xiaoshuangsu/dictation-shadowing-tool" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="mailto:support@example.com" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} ShadowHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
