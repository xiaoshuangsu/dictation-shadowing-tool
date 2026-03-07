"use client"

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = 'force-dynamic'

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function EnRedirect() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 设置语言为英文
    localStorage.setItem("language", "en")

    // 移除 /en 前缀并重定向
    const newPath = pathname.replace(/^\/en/, "") || "/"

    // 使用 replace 避免返回按钮回到重定向页面
    router.replace(newPath)
  }, [pathname, router])

  // 显示加载状态
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
