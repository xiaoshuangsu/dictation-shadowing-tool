/**
 * Convert a title to a URL-friendly slug
 * Example: "First Snowfall" -> "first-snowfall"
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate slug for a material
 */
export function getMaterialSlug(title: string, id: string): string {
  const slug = titleToSlug(title)
  // Include ID to ensure uniqueness (in case titles are similar)
  return `${slug}-${id.slice(0, 8)}`
}
