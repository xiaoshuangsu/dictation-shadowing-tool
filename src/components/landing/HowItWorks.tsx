"use client"

import { motion } from "framer-motion"
import { Play, PenTool, Target, TrendingUp } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useMemo } from "react"

export default function HowItWorks() {
  const { t } = useLanguage()

  const steps = useMemo(() => [
    {
      icon: Play,
      title: t("how.step1.title"),
      description: t("how.step1.desc"),
      color: "bg-blue-500",
    },
    {
      icon: PenTool,
      title: t("how.step2.title"),
      description: t("how.step2.desc"),
      color: "bg-purple-500",
    },
    {
      icon: Target,
      title: t("how.step3.title"),
      description: t("how.step3.desc"),
      color: "bg-green-500",
    },
    {
      icon: TrendingUp,
      title: t("how.step4.title"),
      description: t("how.step4.desc"),
      color: "bg-orange-500",
    },
  ], [t])

  return (
    <section className="py-20 bg-white">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {t("how.title")}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t("how.subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
            >
              {/* Connection line (desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 right-0 w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent transform translate-x-1/2" />
              )}

              <div className="relative bg-gray-50 rounded-2xl p-6 h-full hover:shadow-xl transition-shadow duration-300">
                {/* Step number badge */}
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className={`${step.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
