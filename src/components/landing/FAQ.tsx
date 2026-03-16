"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      question: "What is dictation practice?",
      answer: "Dictation practice is a language learning technique where you listen to audio and write down what you hear. It helps improve listening comprehension, spelling, and grammar skills.",
    },
    {
      question: "What is shadowing practice?",
      answer: "Shadowing is a language learning method where you repeat spoken language immediately after hearing it, like an echo. It helps improve pronunciation, intonation, and speaking fluency.",
    },
    {
      question: "How do I get started?",
      answer: "Simply browse our topics page, select a video that interests you, and choose between dictation or shadowing mode. Start practicing and track your progress!",
    },
    {
      question: "Is this free to use?",
      answer: "Yes! Our core features are completely free. Simply sign up for an account to track your progress and save your statistics.",
    },
    {
      question: "What proficiency levels do you support?",
      answer: "We offer materials from beginner (A1) to advanced (C2) levels. You can filter by difficulty to find content that matches your current level.",
    },
    {
      question: "Can I use this on mobile devices?",
      answer: "Yes! Our platform is fully responsive and works on desktop, tablet, and mobile devices. Practice anywhere, anytime.",
    },
    {
      question: "How accurate is the AI feedback?",
      answer: "Our AI uses advanced speech recognition and natural language processing to provide highly accurate feedback on your pronunciation and dictation.",
    },
    {
      question: "Do I need to create an account?",
      answer: "While you can browse without an account, creating one allows you to save your progress, track statistics, and sync across devices.",
    },
    {
      question: "What video sources do you use?",
      answer: "We use a variety of authentic English content including educational videos, news, movies, and TV shows to provide diverse learning materials.",
    },
    {
      question: "How often should I practice?",
      answer: "We recommend practicing for 15-30 minutes daily. Consistent practice is key to improvement. Use our streak tracking to maintain your habit!",
    },
    {
      question: "Can I customize the playback speed?",
      answer: "Yes! You can adjust the audio playback speed from 0.25x to 2x to match your comfort level and gradually increase as you improve.",
    },
    {
      question: "What's the difference between word and sentence mode?",
      answer: "Word mode focuses on individual words in a sentence, while sentence mode requires you to type the complete sentence. Start with word mode and progress to sentence mode.",
    },
    {
      question: "Can I see my progress over time?",
      answer: "Absolutely! Your account includes detailed charts and statistics showing your practice history, accuracy rates, and improvement trends.",
    },
    {
      question: "Is my pronunciation recorded?",
      answer: "In shadowing mode, yes - your voice is recorded for analysis. Your recordings are processed locally and used only to provide feedback on your pronunciation.",
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
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600">
            Find answers to common questions about our platform
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
