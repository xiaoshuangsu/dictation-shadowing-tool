"use client"

import { motion } from "framer-motion"
import { Play, PenTool, Target, TrendingUp } from "lucide-react"

const steps = [
  {
    icon: Play,
    title: "Choose Materials",
    description: "Select English listening content that suits you from a rich library, covering various themes like daily conversations, news, and stories.",
    color: "bg-blue-500",
  },
  {
    icon: PenTool,
    title: "Listen and Dictate",
    description: "Listen carefully and type exactly what you hear. Two modes are available: Word Mode and Whole Caption Mode. AI automatically checks answers and provides feedback.",
    color: "bg-purple-500",
  },
  {
    icon: Target,
    title: "Shadow and Record",
    description: "Repeat the audio immediately after the speaker, and get detailed feedback on your pronunciation. Turn mistakes into improvement.",
    color: "bg-green-500",
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "View detailed statistics, track learning progress, and witness your continuous improvement.",
    color: "bg-orange-500",
  },
]

export default function HowItWorks() {
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
            How It Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Only 4 steps, making English practice easier and more enjoyable
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
