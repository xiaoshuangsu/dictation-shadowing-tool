import DictationPracticeClient from './DictationPracticeClient'

// Tell Next.js that all slug params should be treated as dynamic
export const dynamicParams = true

// Generate static params for build time
// Return a sample slug to satisfy static export requirements
export async function generateStaticParams() {
  return [{ slug: 'first-snowfall' }]
}

export default function DictationPracticePage({
  params,
}: {
  params: { slug: string }
}) {
  return <DictationPracticeClient slug={params.slug} />
}
