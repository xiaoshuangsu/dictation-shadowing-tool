"use client"

import { motion } from "framer-motion"
import { Sparkles, AlertCircle, Lightbulb, CheckCircle2, ArrowRight } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import LocalizedLink from "@/components/LocalizedLink"

export default function FeatureAI() {
  const { t } = useLanguage()
  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-white">
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
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <Sparkles className="w-4 h-4" />
                {t("feature.ai.smart")}
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                {t("feature.ai.title2")}
              </h2>

              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {t("feature.ai.desc2")}
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.ai.spell")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.ai.spellDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.ai.linking")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.ai.linkingDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.ai.analysis")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.ai.analysisDesc")}</p>
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  📈 {t("feature.ai.trend")}
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  🎯 {t("feature.ai.personalized")}
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                  ⚡ {t("feature.ai.realtime")}
                </div>
              </div>

              {/* Try now button */}
              <LocalizedLink
                href="/topics"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
              >
                {t("feature.ai.try")}
                <ArrowRight className="w-5 h-5" />
              </LocalizedLink>
            </motion.div>
          </div>

          {/* Right side: Image */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <img
                src="ai-feedback.png"
                alt="learn english with AI"
                className="w-full h-auto rounded-3xl shadow-2xl"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
