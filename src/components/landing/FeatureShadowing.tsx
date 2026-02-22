"use client"

import { motion } from "framer-motion"
import { Mic, Volume2, Waves, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function FeatureShadowing() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left side: UI mockup */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl shadow-2xl p-6 border border-purple-100">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Mic className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Shadowing Practice</h3>
                      <p className="text-sm text-gray-500">Sentence 5/22</p>
                    </div>
                  </div>
                  <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                    Shadowing
                  </div>
                </div>

                {/* Original text with linking curve */}
                <div className="bg-white rounded-2xl p-6 mb-6 relative">
                  <p className="text-slate-900 text-lg leading-relaxed mb-2">
                    My sister and I go outside.
                  </p>
                  <p className="text-gray-500 text-sm mb-4">My sister and I go outside.</p>

                  {/* Linking curve visualization */}
                  <div className="relative h-8 mt-4">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 30">
                      {/* Linking curve between "sister and" */}
                      <path
                        d="M 80 25 Q 120 5 150 25"
                        stroke="#8B5CF6"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="4 2"
                      />
                      <circle cx="115" cy="15" r="3" fill="#8B5CF6" />
                    </svg>
                  </div>
                  <p className="text-xs text-purple-600 flex items-center gap-1">
                    <Waves className="w-3 h-3" />
                    Linking Tip: sister_and links to /sɪstərənd/
                  </p>
                </div>

                {/* Recording section */}
                <div className="space-y-4">
                  <div className="text-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all mx-auto"
                    >
                      <Mic className="w-8 h-8 text-white" />
                    </motion.button>
                    <p className="text-sm text-gray-600 mt-3">Click to start recording</p>
                  </div>

                  {/* Audio player for original */}
                  <div className="bg-white rounded-xl p-3 flex items-center gap-3">
                    <button className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-purple-600" />
                    </button>
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-500 rounded-full h-2 w-1/2"></div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">0:02 / 0:04</span>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-10"
              >
                <span className="text-sm font-semibold">🎤 Mimic Intonation</span>
              </motion.div>
            </motion.div>
          </div>

          {/* Right side: Text content */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <Mic className="w-4 h-4" />
                Shadowing Practice
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Mimic Native Speakers, Master Authentic Pronunciation
              </h2>

              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Shadowing is the golden method for language learning. Through synchronized repetition, train oral muscle memory and master authentic intonation and linking techniques.
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Synchronized Repetition</h4>
                    <p className="text-gray-600 text-sm">Sync with the original audio, train instant reaction ability</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Linking Tips</h4>
                    <p className="text-gray-600 text-sm">Intelligently mark linking positions, master natural fluency</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Intonation Mimicry</h4>
                    <p className="text-gray-600 text-sm">Learn stress, pauses, and intonation changes</p>
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 text-sm text-purple-700">
                  🎯 Improve Speaking Fluency
                </div>
                <div className="bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 text-sm text-purple-700">
                  🗣️ Correct Pronunciation Issues
                </div>
                <div className="bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 text-sm text-purple-700">
                  📊 AI Scoring Feedback
                </div>
              </div>

              {/* Try now button */}
              <Link
                href="/topics"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl"
              >
                Try now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
