import { Suspense } from 'react'
import ShadowingPracticeClient from './ShadowingPracticeClient'

// Tell Next.js that all slug params should be treated as dynamic
export const dynamicParams = true

// Generate static params for build time
export function generateStaticParams() {
  return []
}

export default function ShadowingPracticePage({
  params,
}: {
  params: { slug: string }
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ShadowingPracticeClient slug={params.slug} />
    </Suspense>
  )
}
