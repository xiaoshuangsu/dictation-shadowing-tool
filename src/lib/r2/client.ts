/**
 * Cloudflare R2 客户端配置
 *
 * 用于访问存储在 R2 上的视频文件
 * 根据设备类型选择不同的 URL 以解决 CORS 和移动端访问问题
 */

// R2 Worker 代理域名（统一使用，所有设备）
const R2_WORKER_URL = 'https://r2-proxy.suxiaoshuang2020.workers.dev'

/**
 * 生成 R2 对象的公开访问 URL
 * 统一使用 Worker 代理，自动处理 CORS 和缓存
 *
 * @param key - R2 对象键名（如 "videos/video-name.mp4"）
 * @returns 完整的公开访问 URL
 */
export function getR2PublicUrl(key: string): string {
  return `${R2_WORKER_URL}/${key}`
}

/**
 * 从 R2 URL 提取对象键名
 *
 * @param url - R2 URL 或完整路径
 * @returns 对象键名
 */
export function extractR2Key(url: string): string {
  // 从 Worker URL 提取
  if (url.includes(R2_WORKER_URL)) {
    return url.replace(`${R2_WORKER_URL}/`, '')
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
  return url.includes(R2_WORKER_URL) || url.includes('workers.dev') || url.includes('r2.dev')
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
