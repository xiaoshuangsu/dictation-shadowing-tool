/**
 * Category mapping for URL-friendly slugs
 */

// Full category name to URL-friendly slug mapping
export const CATEGORY_SLUG_MAP: Record<string, string> = {
  '日常生活': 'daily-life',
  '历史演讲': 'historical-speeches',
  '文化历史': 'culture-history',
  '心灵故事': 'heart-soul-stories',
  '艺术文化': 'arts-culture',
  'YouTube Vlog': 'youtube-vlog',
  '故事': 'stories',
  '人物访谈': 'interviews',
  'BBC Learning English': 'bbc-learning-english',
  'VOA Learning English': 'voa-learning-english',
  'TED演讲': 'ted-talks',
  '动画片': 'cartoons',
  'IELTS Listening': 'ielts-listening',
}

// Reverse mapping: slug to category name
export const SLUG_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_SLUG_MAP).map(([key, value]) => [value, key])
)

/**
 * Convert category name to URL-friendly slug
 */
export function categoryToSlug(category: string): string {
  return CATEGORY_SLUG_MAP[category] || category.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Convert URL-friendly slug back to category name
 */
export function slugToCategory(slug: string): string {
  return SLUG_CATEGORY_MAP[slug] || slug
}

/**
 * Category metadata for UI display
 */
export interface CategoryMetadata {
  name: string
  slug: string
  description: string
  icon: string
  color: string
  gradient: string
}

/**
 * Category metadata with descriptions, icons, and colors
 */
export const CATEGORY_METADATA: Record<string, CategoryMetadata> = {
  '日常生活': {
    name: 'Daily Life',
    slug: 'daily-life',
    description: 'Practical conversations and scenarios from everyday life',
    icon: '🏠',
    color: 'bg-blue-500',
    gradient: 'from-blue-500 to-blue-600',
  },
  '历史演讲': {
    name: 'Historical Speeches',
    slug: 'historical-speeches',
    description: 'Iconic speeches that shaped history',
    icon: '🎤',
    color: 'bg-amber-600',
    gradient: 'from-amber-600 to-amber-700',
  },
  '文化历史': {
    name: 'Culture & History',
    slug: 'culture-history',
    description: 'Explore cultural heritage and historical events',
    icon: '🏛️',
    color: 'bg-purple-600',
    gradient: 'from-purple-600 to-purple-700',
  },
  '心灵故事': {
    name: 'Heart & Soul Stories',
    slug: 'heart-soul-stories',
    description: 'Inspirational stories touching the heart and soul',
    icon: '❤️',
    color: 'bg-pink-500',
    gradient: 'from-pink-500 to-pink-600',
  },
  '艺术文化': {
    name: 'Arts & Culture',
    slug: 'arts-culture',
    description: 'Discover art, music, and cultural expressions',
    icon: '🎨',
    color: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-indigo-600',
  },
  'YouTube Vlog': {
    name: 'YouTube Vlog',
    slug: 'youtube-vlog',
    description: 'Popular vlog content from YouTube creators',
    icon: '📹',
    color: 'bg-red-500',
    gradient: 'from-red-500 to-red-600',
  },
  '故事': {
    name: 'Stories',
    slug: 'stories',
    description: 'Engaging stories for language learning',
    icon: '📖',
    color: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  '人物访谈': {
    name: 'Interviews',
    slug: 'interviews',
    description: 'Interviews with interesting people',
    icon: '🎙️',
    color: 'bg-teal-500',
    gradient: 'from-teal-500 to-teal-600',
  },
  'BBC Learning English': {
    name: 'BBC Learning English',
    slug: 'bbc-learning-english',
    description: 'English learning content from BBC',
    icon: '🇬🇧',
    color: 'bg-sky-600',
    gradient: 'from-sky-600 to-sky-700',
  },
  'VOA Learning English': {
    name: 'VOA Learning English',
    slug: 'voa-learning-english',
    description: 'English learning content from Voice of America',
    icon: '🇺🇸',
    color: 'bg-blue-700',
    gradient: 'from-blue-700 to-blue-800',
  },
  'TED演讲': {
    name: 'TED Talks',
    slug: 'ted-talks',
    description: 'Ideas worth spreading from TED',
    icon: '💡',
    color: 'bg-red-600',
    gradient: 'from-red-600 to-red-700',
  },
  '动画片': {
    name: 'Cartoons',
    slug: 'cartoons',
    description: 'Animated content for fun learning',
    icon: '🎬',
    color: 'bg-orange-500',
    gradient: 'from-orange-500 to-orange-600',
  },
  'IELTS Listening': {
    name: 'IELTS Listening',
    slug: 'ielts-listening',
    description: 'Cambridge IELTS listening practice tests',
    icon: '🎧',
    color: 'bg-violet-600',
    gradient: 'from-violet-600 to-violet-700',
  },
}

/**
 * Get category metadata by Chinese name
 */
export function getCategoryMetadata(category: string): CategoryMetadata {
  return CATEGORY_METADATA[category] || {
    name: category,
    slug: categoryToSlug(category),
    description: `Learning materials for ${category}`,
    icon: '📚',
    color: 'bg-gray-500',
    gradient: 'from-gray-500 to-gray-600',
  }
}

/**
 * Get category metadata by slug
 */
export function getCategoryMetadataBySlug(slug: string): CategoryMetadata | null {
  const category = slugToCategory(slug)
  return CATEGORY_METADATA[category] || null
}

/**
 * Get all category metadata
 */
export function getAllCategories(): CategoryMetadata[] {
  return Object.values(CATEGORY_METADATA)
}
