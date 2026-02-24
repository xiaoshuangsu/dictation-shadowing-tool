import ShadowingPracticeClient from './ShadowingPracticeClient'

// Tell Next.js that all slug params should be treated as dynamic
export const dynamicParams = true

// Generate static params for build time
export function generateStaticParams() {
  return [{ slug: 'first-snowfall' }]
}

export default function ShadowingPracticePage({
  params,
}: {
  params: { slug: string }
}) {
  return <ShadowingPracticeClient slug={params.slug} />
}
