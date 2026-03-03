/**
 * Convert a title to a URL-friendly slug
 * Example: "First Snowfall" -> "first-snowfall"
 * Example: "[Time] What time is it?" -> "what-time-is-it"
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // 移除方括号内的内容，如 [Time], [Video] 等
    .replace(/\[[^\]]*\]/g, '')
    // 移除常见的特殊前缀标记，如 "Easy Dialogue", "Beginner English", "English video for Kids" 等
    .replace(/ - easy dialogue/g, '')
    .replace(/ - beginner english/g, '')
    .replace(/ - english video for kids/g, '')
    .replace(/ - intermediate/g, '')
    .replace(/ - advanced/g, '')
    .replace(/ - culture and history stories for kids/g, '')
    .replace(/ - little fox/g, '')
    .replace(/ - an english conversation/g, '')
    .replace(/ - english educational animation/g, '')
    // 移除多余的分隔符
    .replace(/[_]+/g, ' ')
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens to single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    // 限制长度到100字符
    .substring(0, 100)
}

/**
 * Generate slug for a material
 */
export function getMaterialSlug(title: string, id: string): string {
  const slug = titleToSlug(title)
  // Include ID to ensure uniqueness (in case titles are similar)
  return `${slug}-${id.slice(0, 8)}`
}
