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
