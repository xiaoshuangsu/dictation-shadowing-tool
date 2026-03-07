// Dynamic routes - generate all material pages at build time
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1eG90bGlqam54YnNpcnBka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk'

export async function generateStaticParams() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: materials } = await supabase
    .from('materials')
    .select('id')

  // Generate routes for all materials
  return (materials || []).map((material) => ({
    slug: material.id,
  }))
}

import ShadowingPracticeClient from './ShadowingPracticeClient'

export default function ShadowingPracticePage({ params }: { params: { slug: string } }) {
  return <ShadowingPracticeClient slug={params.slug} />
}
