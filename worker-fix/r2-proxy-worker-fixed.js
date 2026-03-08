/**
 * R2 Proxy Worker - 支持视频/音频 Range 请求
 * 用于 shadowhub.app 媒体资源代理
 *
 * 绑定名称：R2
 */

export default {
  async fetch(request, env, ctx) {
    try {
      // 处理 CORS 预检请求
      if (request.method === 'OPTIONS') {
        return handleOptions()
      }

      const url = new URL(request.url)
      // 移除前缀，获取 R2 路径（例如：/videos/xxx.mp4 -> videos/xxx.mp4）
      const r2Key = url.pathname.replace(/^\//, '')

      // 检查文件扩展名以确定 MIME 类型
      const mimeType = getMimeType(r2Key)

      // 从 R2 获取对象（使用绑定名称 R2）
      const object = await env.R2.get(r2Key, {
        range: request.headers.get('Range') || undefined,
        method: request.method
      })

      if (!object) {
        return new Response('Object not found', { status: 404 })
      }

      // 构建响应头
      const headers = new Headers()
      headers.set('Content-Type', mimeType)
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
      headers.set('Accept-Ranges', 'bytes')

      // 处理 Range 请求
      if (object.range) {
        const range = object.range
        headers.set('Content-Range', `bytes ${range.offset}-${range.end}/${object.size}`)
        headers.set('Content-Length', String(range.end - range.offset + 1))

        return new Response(object.body, {
          status: 206, // Partial Content
          headers
        })
      }

      // 完整文件请求
      headers.set('Content-Length', String(object.size))
      headers.set('Cache-Control', 'public, max-age=86400') // 缓存 24 小时

      return new Response(object.body, {
        status: 200,
        headers
      })

    } catch (error) {
      console.error('Worker error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}

/**
 * 根据文件扩展名返回正确的 MIME 类型
 */
function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop()

  const mimeTypes = {
    // 视频
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',

    // 音频
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',

    // 图片
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * 处理 CORS 预检请求
 */
function handleOptions() {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
  headers.set('Access-Control-Max-Age', '86400')

  return new Response(null, {
    status: 204,
    headers
  })
}
