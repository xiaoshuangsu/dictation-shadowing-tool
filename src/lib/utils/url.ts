/**
 * URL 规范化工具函数
 * 确保 API 路径拼接安全，避免双斜杠或末尾斜杠问题
 */

/**
 * 获取基础 URL（从环境变量或浏览器获取）
 * @returns 基础 URL（例如：https://shadowhub.app）
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 浏览器环境：使用当前域名
    return window.location.origin;
  }

  // 服务器环境：使用环境变量
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    // 移除末尾斜杠
    return siteUrl.replace(/\/+$/, '');
  }

  // 默认：localhost
  return 'http://localhost:3000';
}

/**
 * 规范化 API 路径拼接
 * 使用 new URL() 确保路径格式正确
 *
 * @param path - API 路径（例如：/api/user-words）
 * @returns 完整的 URL（例如：https://shadowhub.app/api/user-words）
 *
 * @example
 * ```ts
 * const url = buildApiUrl('/api/user-words')
 * // => https://shadowhub.app/api/user-words
 *
 * const url = buildApiUrl('/api/user-words?status=learning')
 * // => https://shadowhub.app/api/user-words?status=learning
 * ```
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getBaseUrl();

  // 确保 path 以斜杠开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // 使用 URL 构造函数规范化拼接
  const url = new URL(normalizedPath, baseUrl);

  return url.toString();
}

/**
 * 规范化页面路径拼接
 * 确保页面 URL 格式正确（不带末尾斜杠）
 *
 * @param path - 页面路径（例如：/topics/daily-life/material-slug）
 * @returns 完整的 URL（例如：https://shadowhub.app/topics/daily-life/material-slug）
 */
export function buildPageUrl(path: string): string {
  const baseUrl = getBaseUrl();

  // 确保 path 以斜杠开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // 使用 URL 构造函数规范化拼接
  const url = new URL(normalizedPath, baseUrl);

  // 移除末尾斜杠（页面 URL 不带末尾斜杠）
  const urlString = url.toString();
  return urlString.replace(/\/$/, '');
}

/**
 * 安全的 fetch 包装器
 * 自动使用规范化 URL 构建 fetch 请求
 *
 * @param path - API 路径
 * @param options - fetch 选项
 * @returns fetch Promise
 *
 * @example
 * ```ts
 * const response = await safeFetch('/api/user-words', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ word: 'hello' })
 * })
 * ```
 */
export async function safeFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = buildApiUrl(path);
  return fetch(url, options);
}
