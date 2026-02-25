"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function HeroVisual() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    // 预加载图片
    const img = new Image()
    img.src = "/hero-banner.png"

    img.onload = () => {
      setImageSrc("/hero-banner.png")
    }

    img.onerror = () => {
      console.error("Failed to load hero-banner.png")
      setImageError(true)
    }

    return () => {
      setImageSrc(null)
    }
  }, [])

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
        {imageSrc && (
          <img
            src={imageSrc}
            alt="Improve English listening and speaking skills with ShadowHub"
            className="relative w-full h-auto"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
        )}

        {/* 加载中状态 */}
        {!imageSrc && !imageError && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600 text-sm">Loading...</p>
          </div>
        )}

        {/* 错误状态 */}
        {imageError && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828-2.828L12 15.172m-2 2l4.586-4.586a2 2 0 012.828-2.828L12 15.172M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-600 text-sm">Image unavailable</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
