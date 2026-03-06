/**
 * Cloudflare R2 客户端配置
 *
 * 用于访问存储在 R2 上的视频文件
 * 根据设备类型选择不同的 URL 以解决 CORS 和移动端访问问题
 */

// R2 公共域名（移动端使用，避免运营商对 workers.dev 的限制）
const R2_PUBLIC_URL = 'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev'

// R2 CORS 代理 Worker（桌面端使用，提供 CORS 头）
const R2_CORS_PROXY = 'https://r2-cors-proxy.suxiaoshuang2020.workers.dev'

/**
 * 检测是否为移动设备
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent)
}

/**
 * 生成 R2 对象的公开访问 URL
 * 根据设备类型自动选择合适的 URL
 *
 * @param key - R2 对象键名（如 "videos/video-name.mp4"）
 * @returns 完整的公开访问 URL
 */
export function getR2PublicUrl(key: string): string {
  // 桌面端：使用 CORS 代理（解决跨域问题）
  // 移动端：直接使用 R2 公共域名（避免运营商限制）
  const baseUrl = isMobileDevice() ? R2_PUBLIC_URL : R2_CORS_PROXY
  return `${baseUrl}/${key}`
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
