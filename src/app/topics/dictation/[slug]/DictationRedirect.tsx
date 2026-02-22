'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cuxotlijjnxbsirpdkgr.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm'
const supabase = createClient(supabaseUrl, supabaseKey)

type Material = {
  id: string
  title: string
  category: string
  audio_path: string
}

export default function DictationRedirect({
  slug,
  mode,
}: {
  slug: string
  mode: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function loadMaterial() {
      try {
        // Fetch all materials to find the matching one
        const { data: materials } = await supabase
          .from('materials')
          .select('id, title, category, audio_path')

        if (!materials) {
          router.push('/topics')
          return
        }

        // Find material by matching slug
        const titleToSlug = (title: string) =>
          title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/^-+|-+$/g, '')

        const material = materials.find(m => titleToSlug(m.title) === slug)

        if (material) {
          // Redirect to practice page with correct parameters
          const query = new URLSearchParams({
            id: material.id,
            mode: mode,
          })
          // Preserve any additional query params (like sentence index)
          for (const [key, value] of Array.from(searchParams.entries())) {
            query.set(key, value)
          }
          router.push(`/practice/?${query.toString()}`)
        } else {
          // Material not found, redirect to topics
          router.push('/topics')
        }
      } catch (error) {
        console.error('Error loading material:', error)
        router.push('/topics')
      }
    }

    loadMaterial()
  }, [slug, mode, router, searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
