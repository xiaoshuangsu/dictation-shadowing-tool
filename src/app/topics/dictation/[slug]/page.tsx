import { Suspense } from 'react'
import { MATERIAL_SLUGS } from '@/lib/data/materialSlugs'
import DictationRedirect from './DictationRedirect'

// Generate static params for all materials at build time
export function generateStaticParams() {
  return MATERIAL_SLUGS
}

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
      <DictationRedirect slug={params.slug} mode="dictation" />
    </Suspense>
  )
}
