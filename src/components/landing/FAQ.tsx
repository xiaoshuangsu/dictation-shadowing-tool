"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

export default function FAQ() {
  const { t } = useLanguage()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      question: t("faq.q1.title"),
      answer: t("faq.q1.answer"),
    },
    {
      question: t("faq.q2.title"),
      answer: t("faq.q2.answer"),
    },
    {
      question: t("faq.q3.title"),
      answer: t("faq.q3.answer"),
    },
    {
      question: t("faq.q4.title"),
      answer: t("faq.q4.answer"),
    },
    {
      question: t("faq.q5.title"),
      answer: t("faq.q5.answer"),
    },
    {
      question: t("faq.q6.title"),
      answer: t("faq.q6.answer"),
    },
    {
      question: t("faq.q7.title"),
      answer: t("faq.q7.answer"),
    },
    {
      question: t("faq.q8.title"),
      answer: t("faq.q8.answer"),
    },
    {
      question: t("faq.q9.title"),
      answer: t("faq.q9.answer"),
    },
    {
      question: t("faq.q10.title"),
      answer: t("faq.q10.answer"),
    },
    {
      question: t("faq.q11.title"),
      answer: t("faq.q11.answer"),
    },
    {
      question: t("faq.q12.title"),
      answer: t("faq.q12.answer"),
    },
    {
      question: t("faq.q13.title"),
      answer: t("faq.q13.answer"),
    },
    {
      question: t("faq.q14.title"),
      answer: t("faq.q14.answer"),
    },
  ]

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-screen-xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <HelpCircle className="w-4 h-4" />
            FAQ
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {t("faq.title")}
          </h2>
          <p className="text-lg text-gray-600">
            {t("faq.subtitle")}
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.03 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-slate-900 pr-8">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                </motion.div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pt-0">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
