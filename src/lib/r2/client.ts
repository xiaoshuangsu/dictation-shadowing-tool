/**
 * Cloudflare R2 客户端配置
 *
 * 用于访问存储在 R2 上的视频文件
 */

// R2 公开访问 URL 配置

// 选项1：使用 Worker 代理（推荐，无速率限制）
const R2_WORKER_URL = process.env.NEXT_PUBLIC_R2_WORKER_URL || 'https://r2-proxy.suxiaoshuang2020.workers.dev'

// 选项2：使用 R2 提供的公开 URL（有速率限制）
const R2_ACCOUNT_ID = process.env.NEXT_PUBLIC_R2_ACCOUNT_ID || ''
const R2_PUBLIC_URL = `https://pub-${R2_ACCOUNT_ID}.r2.dev`

// 选项3：使用自定义域名（如果已配置）
// const R2_CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_R2_DOMAIN || 'https://videos.yourdomain.com'

/**
 * 生成 R2 对象的公开访问 URL
 *
 * @param key - R2 对象键名（如 "videos/video-name.mp4"）
 * @returns 完整的公开访问 URL
 */
export function getR2PublicUrl(key: string): string {
  // 优先使用 Worker 代理 URL（无速率限制）
  return `${R2_WORKER_URL}/${key}`

  // 或使用 R2 默认公开 URL（有速率限制）
  // return `${R2_PUBLIC_URL}/${key}`

  // 或使用自定义域名（如果已配置）
  // return `${R2_CUSTOM_DOMAIN}/${key}`
}

/**
 * 从 R2 URL 提取对象键名
 *
 * @param url - R2 URL 或完整路径
 * @returns 对象键名
 */
export function extractR2Key(url: string): string {
  // 尝试从 Worker URL 提取
  if (url.includes(R2_WORKER_URL)) {
    return url.replace(`${R2_WORKER_URL}/`, '')
  }
  // 尝试从公开 URL 提取
  if (url.includes(R2_PUBLIC_URL)) {
    return url.replace(`${R2_PUBLIC_URL}/`, '')
  }
  // 如果已经是键名，直接返回
  return url
}

/**
 * 检查 URL 是否为 R2 URL
 *
 * @param url - URL 字符串
 * @returns 是否为 R2 URL
 */
export function isR2Url(url: string): boolean {
  return url.includes('workers.dev') || url.includes('r2.dev') || url.includes(R2_WORKER_URL) || url.includes(R2_PUBLIC_URL)
}

/**
 * R2 资源类型
 */
export enum R2ResourceType {
  VIDEO = 'videos',
  AUDIO = 'audio',
  THUMBNAIL = 'thumbnails',
}

/**
 * 构建 R2 对象键名
 *
 * @param type - 资源类型
 * @param filename - 文件名
 * @returns R2 对象键名
 */
export function buildR2Key(type: R2ResourceType, filename: string): string {
  return `${type}/${filename}`
}
