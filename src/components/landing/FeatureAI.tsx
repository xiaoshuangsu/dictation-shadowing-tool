"use client"

import { motion } from "framer-motion"
import { Sparkles, AlertCircle, Lightbulb, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function FeatureAI() {
  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left side: Text content */}
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <Sparkles className="w-4 h-4" />
                AI Smart Correction
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Precise Diagnosis, Targeted Improvement
              </h2>

              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Say goodbye to blind practice. AI intelligently analyzes your input, precisely locates error types, and provides personalized improvement suggestions, making every practice session clearly rewarding.
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Spell Check</h4>
                    <p className="text-gray-600 text-sm">Automatically identify spelling errors and capitalization issues</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Linking Suggestions</h4>
                    <p className="text-gray-600 text-sm">Suggest natural linking methods, improve speaking fluency</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">Error Analysis</h4>
                    <p className="text-gray-600 text-sm">Categorize and count error types, discover weak areas</p>
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  📈 Error Trend Tracking
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  🎯 Personalized Suggestions
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  ⚡ Real-time Feedback
                </div>
              </div>

              {/* Try now button */}
              <Link
                href="/topics"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
              >
                Try now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>

          {/* Right side: UI mockup */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-green-100">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">AI Diagnostic Report</h3>
                      <p className="text-sm text-gray-500">Sentence 3</p>
                    </div>
                  </div>
                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                    85% Accurate
                  </div>
                </div>

                {/* Original vs Input comparison */}
                <div className="space-y-4 mb-6">
                  {/* Original */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Original Text
                    </p>
                    <p className="text-slate-900">The snow is beautiful.</p>
                  </div>

                  {/* User input with errors highlighted */}
                  <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
                    <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Your Input
                    </p>
                    <p className="text-lg">
                      <span className="text-green-600 font-medium">The</span>{" "}
                      <span className="text-green-600 font-medium">snow</span>{" "}
                      <span className="bg-red-200 text-red-800 px-1 rounded decoration-red-500 underline decoration-2">are</span>{" "}
                      <span className="text-green-600 font-medium">beautiful</span>
                      <span className="text-gray-400">.</span>
                    </p>
                  </div>
                </div>

                {/* Error analysis cards */}
                <div className="space-y-3">
                  {/* Error 1 */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-1">Subject-Verb Agreement Error</h4>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="line-through text-red-600">are</span> →{" "}
                          <span className="text-green-600 font-medium">is</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          The subject "snow" is singular, so the verb should be "is"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Suggestion */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-1">Improvement Suggestion</h4>
                        <p className="text-sm text-gray-600">
                          Pay attention to singular subjects matching singular verbs. Recommend reviewing third-person singular usage.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall stats */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">85%</p>
                      <p className="text-xs text-gray-500">Accuracy</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-500">1</p>
                      <p className="text-xs text-gray-500">Errors</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">A</p>
                      <p className="text-xs text-gray-500">Grade</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
