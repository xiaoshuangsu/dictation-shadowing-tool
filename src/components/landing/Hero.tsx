"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-24 md:py-32 overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 relative">
        <div className="text-center">
          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-8 text-gray-900">
            Stop Studying English.
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Start Feeling It.
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-gray-500 mb-12 leading-relaxed max-w-2xl mx-auto">
            Master the natural flow of English through immersive dictation and shadowing. Turn real-world content into your personal language coach.
          </p>

          {/* CTA Button */}
          <div className="flex justify-center">
            <Link
              href="/topics"
              className="inline-flex items-center justify-center px-10 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-full font-semibold text-lg hover:from-slate-900 hover:to-black transition-all shadow-lg hover:shadow-xl"
            >
              Start Practicing
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-10 -translate-x-1/2 translate-y-1/2"></div>
    </section>
  )
}
