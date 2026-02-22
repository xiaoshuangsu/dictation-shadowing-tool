"use client"

import { motion } from "framer-motion"

export default function FeaturesTitle() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
        >
          Speak Naturally. Remember Deeply.
        </motion.h2>
      </div>
    </section>
  )
}
