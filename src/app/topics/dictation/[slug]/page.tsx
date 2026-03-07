import { Suspense } from 'react'
import DictationPracticeClient from './DictationPracticeClient'

// Force dynamic rendering to avoid build-time pre-rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default function DictationPracticePage({
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
      <DictationPracticeClient slug={params.slug} />
    </Suspense>
  )
}
