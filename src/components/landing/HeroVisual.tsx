"use client"

import { motion } from "framer-motion"

export default function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative w-full max-w-xl mx-auto flex items-center justify-center"
      style={{ maxHeight: '450px' }}
    >
      {/* 浅蓝渐变背景 */}
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 50%, #DDD6FE 100%)',
          opacity: 0.3,
        }}
      />

      {/* 浮动动画容器 */}
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        <img
          src="/hero-banner.png"
          alt="Improve English listening and speaking skills with ShadowHub"
          className="relative w-full h-auto"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
          onError={(e) => {
            console.error("Image load error:", e)
            // 隐藏图片，显示背景
            e.currentTarget.style.display = 'none'
          }}
        />
      </motion.div>
    </motion.div>
  )
}
