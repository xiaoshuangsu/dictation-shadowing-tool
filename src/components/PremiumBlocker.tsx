/**
 * PremiumBlocker - 付费素材拦截面板
 *
 * 功能：
 * - 替换中栏的练习交互组件
 * - 引导用户升级到 PRO 账户
 * - 保持与原练习区域一致的高度
 */

'use client'

import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

interface PremiumBlockerProps {
  materialTitle?: string
}

export default function PremiumBlocker({ materialTitle }: PremiumBlockerProps) {
  const router = useRouter()

  const handleUnlock = () => {
    router.push('/pricing')
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-lg p-8">
      <div className="text-center max-w-md">
        {/* 锁头图标 */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg mb-6">
          <Lock className="w-10 h-10 text-white" strokeWidth={2} />
        </div>

        {/* 标题 */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Premium Feature
        </h2>

        {/* 副标题 */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          This practice mode is for <span className="font-semibold text-purple-600">PRO accounts</span>. Upgrade to unlock all lessons.
        </p>

        {/* 亮点列表 */}
        <div className="text-left bg-white/70 backdrop-blur-sm rounded-xl p-5 mb-8 space-y-3 border border-purple-100">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-700">Unlock all premium materials (1000+ lessons)</span>
          </div>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-700">Full dictation and shadowing practice</span>
          </div>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-700">Word translation and vocabulary review</span>
          </div>
        </div>

        {/* 解锁按钮 */}
        <button
          onClick={handleUnlock}
          className="w-full inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          Unlock PRO
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* 价格提示 */}
        <p className="text-xs text-gray-500 mt-4">
          From $2.99/month • Cancel anytime
        </p>
      </div>
    </div>
  )
}
