"use client"

import { motion } from "framer-motion"
import { TrendingUp, Trophy, Flame, Calendar, ArrowRight } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import LocalizedLink from "@/components/LocalizedLink"

export default function FeatureGrowth() {
  const { t } = useLanguage()

  // Mock data for the chart
  const weekData = [
    { day: "Mon", value: 30 },
    { day: "Tue", value: 45 },
    { day: "Wed", value: 35 },
    { day: "Thu", value: 60 },
    { day: "Fri", value: 55 },
    { day: "Sat", value: 75 },
    { day: "Sun", value: 90 },
  ]

  const maxVal = Math.max(...weekData.map(d => d.value))

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
          {/* Left side: UI mockup */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-3xl shadow-2xl p-6 border border-orange-100">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{t("feature.growth.statistics")}</h3>
                    <p className="text-sm text-gray-500">{t("feature.growth.pastDays")}</p>
                  </div>
                  <div className="flex items-center gap-2 text-orange-600">
                    <Flame className="w-5 h-5" />
                    <span className="font-bold">7 {t("feature.growth.dayStreak")}</span>
                  </div>
                </div>

                {/* Progress curve chart */}
                <div className="bg-white rounded-2xl p-6 mb-6">
                  <div className="flex items-end justify-between gap-2 h-48">
                    {weekData.map((d, i) => (
                      <motion.div
                        key={d.day}
                        initial={{ height: 0 }}
                        whileInView={{ height: `${(d.value / maxVal) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div className="w-full bg-gradient-to-t from-orange-500 to-yellow-400 rounded-t-lg relative group" style={{ height: `${(d.value / maxVal) * 100}%` }}>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {d.value} pts
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{d.day}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Trophy className="w-6 h-6 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">156</p>
                    <p className="text-xs text-gray-500">{t("feature.growth.totalPractices")}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">89%</p>
                    <p className="text-xs text-gray-500">{t("feature.growth.avgAccuracy")}</p>
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-white rounded-xl p-4">
                  <h4 className="font-semibold text-slate-900 mb-3 text-sm">{t("feature.growth.todayActivity")}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700">{t("feature.growth.completed")} 12 {t("feature.growth.sentences")}</span>
                      </div>
                      <span className="text-green-600 font-medium">+24 pts</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-700">{t("feature.growth.practiceTime")}</span>
                      </div>
                      <span className="text-blue-600 font-medium">18 min</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-gray-700">{t("feature.growth.dictationPractice")}</span>
                      </div>
                      <span className="text-purple-600 font-medium">8 {t("feature.growth.sentences")}</span>
                    </div>
                  </div>
                </div>
              </div>
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
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <TrendingUp className="w-4 h-4" />
                {t("feature.growth.tracking")}
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                {t("feature.growth.title2")}
              </h2>

              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {t("feature.growth.desc2")}
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.growth.practice")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.growth.practiceDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.growth.streakRecord")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.growth.streakRecordDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.growth.charts")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.growth.chartsDesc")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{t("feature.growth.achievement")}</h4>
                    <p className="text-gray-600 text-sm">{t("feature.growth.achievementDesc")}</p>
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 text-sm text-orange-700">
                  📊 {t("feature.growth.detailedData")}
                </div>
                <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 text-sm text-orange-700">
                  🏆 {t("feature.growth.achievementBadges")}
                </div>
                <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 text-sm text-orange-700">
                  🔥 {t("feature.growth.studyHabits")}
                </div>
              </div>

              {/* Try now button */}
              <LocalizedLink
                href="/topics"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl font-semibold hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl"
              >
                {t("feature.growth.try")}
                <ArrowRight className="w-5 h-5" />
              </LocalizedLink>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
