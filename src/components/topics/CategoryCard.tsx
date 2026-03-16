import Link from 'next/link'
import { CategoryMetadata } from '@/lib/utils/category'

interface CategoryCardProps {
  category: CategoryMetadata
  materialCount: number
  difficultyDistribution?: {
    A1?: number
    A2?: number
    B1?: number
    B2?: number
  }
}

export function CategoryCard({ category, materialCount, difficultyDistribution }: CategoryCardProps) {
  // Calculate difficulty percentages for visualization
  const totalDifficulties = Object.values(difficultyDistribution || {}).reduce((sum, count) => sum + count, 0)

  return (
    <Link
      href={`/topics/${category.slug}`}
      className="group block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300"
    >
      {/* Header with icon and gradient background */}
      <div className={`relative h-32 bg-gradient-to-br ${category.gradient} overflow-hidden`}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        {/* Icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl transform group-hover:scale-110 transition-transform duration-300">
            {category.icon}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Category name */}
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {category.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {category.description}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          {/* Material count */}
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-gray-700 font-medium">{materialCount} lessons</span>
          </div>

          {/* Arrow indicator */}
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Difficulty distribution badges */}
        {difficultyDistribution && totalDifficulties > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.entries(difficultyDistribution)
              .filter(([_, count]) => count > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([difficulty, count]) => (
                <span
                  key={difficulty}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    difficulty === 'A1' ? 'bg-green-100 text-green-700' :
                    difficulty === 'A2' ? 'bg-blue-100 text-blue-700' :
                    difficulty === 'B1' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}
                >
                  {difficulty}: {count}
                </span>
              ))}
          </div>
        )}
      </div>
    </Link>
  )
}
