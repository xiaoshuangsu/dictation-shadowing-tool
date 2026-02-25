"use client"

import { motion } from "framer-motion"
import { Mic, Volume2, Waves, ArrowRight } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import LocalizedLink from "@/components/LocalizedLink"

export default function FeatureShadowing() {
  const { t } = useLanguage()

  return (
    <section className="py-20 bg-white">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left side: Image */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <img
                src="/english-shadowing-practice.png"
                alt="English shadowing practice"
                className="w-full h-auto rounded-3xl shadow-2xl"
              />
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
                {t("footer.shadowing")}
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                {t("feature.shadowing.title2")}
              </h2>

              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {t("feature.shadowing.desc2")}
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.shadowing.sync")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.shadowing.syncDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.shadowing.linking")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.shadowing.linkingDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.shadowing.intonation")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.shadowing.intonationDesc")}</p>
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 text-sm text-purple-700">
                  🎯 {t("feature.shadowing.fluency")}
                </div>
                <div className="bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 text-sm text-purple-700">
                  🗣️ {t("feature.shadowing.pronunciation")}
                </div>
                <div className="bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 text-sm text-purple-700">
                  📊 {t("feature.shadowing.scoring")}
                </div>
              </div>

              {/* Try now button */}
              <LocalizedLink
                href="/topics"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl"
              >
                {t("feature.shadowing.try")}
                <ArrowRight className="w-5 h-5" />
              </LocalizedLink>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
