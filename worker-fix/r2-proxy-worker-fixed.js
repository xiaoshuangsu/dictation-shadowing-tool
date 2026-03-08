/**
 * R2 Proxy Worker - 支持视频/音频 Range 请求
 * 用于 shadowhub.app 媒体资源代理
 *
 * 绑定名称：R2
 *
 * 🎯 关键修复：解决 iOS Code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED)
 * - 强制返回正确的 Content-Type: video/mp4
 * - 完美支持 Range 请求，返回 206 Partial Content
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

      // 🔴 关键：检查并强制添加 .mp4 后缀
      let finalKey = r2Key
      if (r2Key.includes('video') && !r2Key.endsWith('.mp4')) {
        finalKey = `${r2Key}.mp4`
        console.log(`🔧 Auto-added .mp4 to key: ${r2Key} -> ${finalKey}`)
      }

      // 检查文件扩展名以确定 MIME 类型（强制设置）
      const mimeType = getMimeType(finalKey)
      console.log(`📦 Fetching: ${finalKey}, MIME: ${mimeType}`)

      // 获取 Range 请求头（完美透传）
      const rangeHeader = request.headers.get('Range')
      console.log(`📍 Range header: ${rangeHeader || 'none'}`)

      // 从 R2 获取对象（使用绑定名称 R2）
      const object = await env.R2.get(finalKey, {
        range: rangeHeader || undefined
      })

      if (!object) {
        console.error(`❌ Object not found: ${finalKey}`)
        return new Response('Object not found', {
          status: 404,
          headers: corsHeaders()
        })
      }

      // 🔴 关键：构建响应头（强制 Content-Type）
      const headers = new Headers()
      headers.set('Content-Type', mimeType) // 强制：video/mp4
      headers.set('Accept-Ranges', 'bytes') // 告诉客户端支持 Range

      // 处理 Range 请求（完美透传，返回 206）
      if (object.range) {
        const range = object.range
        headers.set('Content-Range', `bytes ${range.offset}-${range.end}/${object.size}`)
        headers.set('Content-Length', String(range.end - range.offset + 1))

        console.log(`✅ Returning 206: ${range.offset}-${range.end}/${object.size}`)

        return new Response(object.body, {
          status: 206, // Partial Content - iOS 必须看到这个状态码
          headers: withCorsHeaders(headers)
        })
      }

      // 完整文件请求
      headers.set('Content-Length', String(object.size))
      headers.set('Cache-Control', 'public, max-age=86400')

      console.log(`✅ Returning 200: size=${object.size}`)

      return new Response(object.body, {
        status: 200,
        headers: withCorsHeaders(headers)
      })

    } catch (error) {
      console.error('❌ Worker error:', error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders()
      })
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
 * 添加 CORS 头到 Headers 对象
 */
function withCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
  return headers
}

/**
 * 获取基础 CORS 头（用于错误响应）
 */
function corsHeaders() {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
  return headers
}

/**
 * 处理 CORS 预检请求
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  })
}
