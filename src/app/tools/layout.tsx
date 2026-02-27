import { ReactNode } from 'react'

export const metadata = {
  title: 'Timestamp Marker - Dictation Shadowing Tool',
  description: 'Adjust timestamps for materials',
}

export default function ToolsLayout({
  children,
}: {
  children: ReactNode
}) {
  // 独立布局，不包含全局导航栏和页脚
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
