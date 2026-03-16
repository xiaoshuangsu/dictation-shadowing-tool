"use client"

import { ArrowRight } from "lucide-react"
import HeroVisual from "./HeroVisual"
import Link from "next/link"

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-20 md:py-28 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 lg:px-12 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left relative z-20">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 flex flex-col text-gray-900">
              <span>Master English Through</span>
              <span>Dictation & Shadowing</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
              Improve your listening, speaking, and pronunciation with real-world videos and AI-powered feedback
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/topics"
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-full font-semibold hover:from-slate-900 hover:to-black transition-all shadow-lg"
              >
                Start Practicing
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Right side visual component */}
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
