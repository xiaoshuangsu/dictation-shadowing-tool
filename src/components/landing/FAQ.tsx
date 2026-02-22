"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"

const faqs = [
  {
    question: "What are Dictation and Shadowing?",
    answer: "They are the \"Power Duo\" of language learning. Dictation acts like a microscope for your ears, helping you catch every hidden detail. Shadowing works like a \"human photocopier\"—you mimic native speakers in real-time (without looking at text) to engrave authentic rhythm and intonation directly into your speech muscles.",
  },
  {
    question: "Why can't I understand native speakers after years of study?",
    answer: "Textbooks teach isolated, \"perfect\" sounds, but real life is full of Linking and Reductions. Our dual-mode dictation (Word + Full Sentence) forces your brain to recognize these \"invisible sounds,\" turning blurry audio into crystal-clear English.",
  },
  {
    question: "Is this tool suitable for beginners?",
    answer: "Absolutely! We've designed the platform for everyone. Our content is organized by difficulty, so you can start with basics that match your current level and gradually level up as you gain confidence.",
  },
  {
    question: "I always forget words. Will this method help?",
    answer: "Rote memorization is dead weight; Dictation and Shadowing are active internalization. Here, words aren't just stored—they're used. By hearing, writing, and speaking them in real-world contexts with various native accents, you build a \"living memory\" that sticks for good.",
  },
  {
    question: "What kind of content do you provide?",
    answer: "We offer a massive library of real-world materials, including TV shows, interviews, fairy tales, daily conversations, BBC, and VOA. Every piece of content is hand-picked to ensure you're learning English that people actually use.",
  },
  {
    question: "Do I need to register an account?",
    answer: "No registration required to start practicing. However, if you register an account, you can save practice records, view detailed statistics, track learning progress, and get a better personalized experience.",
  },
  {
    question: "What's the difference between Dictation and Shadowing modes?",
    answer: "Dictation mode trains listening comprehension and spelling through word-by-word or full-sentence dictation; Shadowing trains speaking pronunciation, intonation, and fluency through synchronized repetition. Using both methods together can comprehensively improve your English level.",
  },
  {
    question: "How do I choose suitable materials?",
    answer: "We recommend choosing based on your English level: beginners can select daily conversations or stories with slower speed and simpler vocabulary; intermediate and advanced learners can try more challenging content like news and speeches. The library has different difficulty levels for you to choose from.",
  },
  {
    question: "How does the AI error correction work?",
    answer: "AI intelligently compares your input with the original text, identifying spelling errors, grammar issues, missing or extra words. The system highlights error locations and provides correct answers and improvement suggestions to help you practice targetedly.",
  },
  {
    question: "Will my practice data be saved?",
    answer: "If you register and log in, all practice records will be automatically saved to the cloud. You can view detailed statistics, practice history, and progress curves in your personal center. Practice data for non-logged-in users is only saved locally in the browser.",
  },
  {
    question: "Can I customize practice content?",
    answer: "We currently provide curated English learning materials. Future versions will support users uploading their own audio content to create personalized practice materials.",
  },
  {
    question: "Do you support mobile devices?",
    answer: "Fully supported! Our tool uses responsive design and works smoothly on computers, tablets, and mobile phones. Practice anytime, anywhere.",
  },
  {
    question: "How do I get started?",
    answer: "It's easy! Sign up for a free account, pick a topic that interests you, and start your journey toward fluency today.",
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
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
            Quickly find answers to common questions about this tool
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
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
