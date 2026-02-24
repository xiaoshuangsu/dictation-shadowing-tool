"use client"

import { motion } from "framer-motion"
import { useLanguage } from "@/contexts/LanguageContext"

export default function FeaturesTitle() {
  const { t } = useLanguage()

  return (
    <section className="py-16 bg-white">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
        >
          {t("features.title")}
        </motion.h2>
      </div>
    </section>
  )
}
