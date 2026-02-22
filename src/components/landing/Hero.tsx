"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import HeroVisual from "./HeroVisual"

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-20 md:py-28 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              Speak Fluent English With Dictation & Shadowing
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
              Improve your English listening and speaking skills with our AI-powered dictation and shadowing exercises.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/topics"
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-full font-semibold hover:from-slate-900 hover:to-black transition-all shadow-lg"
              >
                Get started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </motion.div>

          {/* Right side visual component */}
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
