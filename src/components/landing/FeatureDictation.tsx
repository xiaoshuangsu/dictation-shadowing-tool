"use client"

import { motion } from "framer-motion"
import { FileText, Headphones, CheckCircle, ArrowRight } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import LocalizedLink from "@/components/LocalizedLink"

export default function FeatureDictation() {
  const { t } = useLanguage()

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 lg:px-12">
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
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <FileText className="w-4 h-4" />
                <span>{t("footer.dictation")}</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                {t("feature.dictation.title")}
              </h2>

              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {t("feature.dictation.desc")}
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.dictation.word")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.dictation.wordDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.dictation.sentence")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.dictation.sentenceDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.dictation.feedback")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.dictation.feedbackDesc")}</p>
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  🎯 {t("feature.dictation.levels")}
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  ⏱️ {t("feature.dictation.speed")}
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  💡 {t("feature.dictation.hint")}
                </div>
              </div>

              {/* Try now button */}
              <LocalizedLink
                href="/topics"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
              >
                {t("feature.dictation.try")}
                <ArrowRight className="w-5 h-5" />
              </LocalizedLink>
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
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Headphones className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{t("footer.dictation")}</h3>
                      <p className="text-sm text-gray-500">{t("feature.shadowing.sentenceN")} 1/22</p>
                    </div>
                  </div>
                  <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    {t("feature.dictation.wordMode")}
                  </div>
                </div>

                {/* Audio player */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-4">
                    <button className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    <div className="flex-1">
                      <div className="bg-white/20 rounded-full h-2">
                        <div className="bg-white rounded-full h-2 w-1/3"></div>
                      </div>
                      <p className="text-white/80 text-xs mt-1">0:03 / 0:08</p>
                    </div>
                  </div>
                </div>

                {/* Word input areas */}
                <div className="space-y-3 mb-6">
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-600 font-medium">✓ {t("feature.dictation.correct")}</span>
                      <span className="text-xs text-gray-500">{t("feature.dictation.wordN")} 1</span>
                    </div>
                    <p className="text-slate-900 font-medium">First</p>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-600 font-medium">✓ {t("feature.dictation.correct")}</span>
                      <span className="text-xs text-gray-500">{t("feature.dictation.wordN")} 2</span>
                    </div>
                    <p className="text-slate-900 font-medium">snowfall</p>
                  </div>
                  <div className="bg-white border-2 border-dashed border-blue-300 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-blue-600 font-medium">⏸️ {t("feature.dictation.playing")}</span>
                      <span className="text-xs text-gray-500">{t("feature.dictation.wordN")} 3</span>
                    </div>
                    <p className="text-gray-400">{t("feature.dictation.typeWhatYouHear")}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                    {t("feature.dictation.checkAnswer")}
                  </button>
                  <button className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                    <Headphones className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Floating indicator */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -right-2 -bottom-2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg z-10"
              >
                <span className="text-sm font-semibold">2/3 Completed</span>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
