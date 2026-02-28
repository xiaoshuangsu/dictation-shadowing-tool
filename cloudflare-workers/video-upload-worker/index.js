/**
 * Cloudflare Worker: 视频上传处理器
 * 功能：接收 YouTube URL，下载视频，上传到 R2
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 路由：上传视频
    if (url.pathname === '/upload' && request.method === 'POST') {
      try {
        const { youtubeUrl, title } = await request.json();

        if (!youtubeUrl) {
          return new Response(
            JSON.stringify({ error: 'Missing youtubeUrl' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 下载视频（调用外部服务或使用 yt-dlp）
        // 注意：Worker 环境限制，建议通过外部服务处理
        const result = await downloadAndUploadVideo(youtubeUrl, title, env);

        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 路由：列出视频
    if (url.pathname === '/list' && request.method === 'GET') {
      try {
        const listed = await env.VIDEOS.list();
        const videos = listed.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
        }));

        return new Response(
          JSON.stringify({ videos }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 默认响应
    return new Response(
      JSON.stringify({
        message: 'Dictation Video Uploader API',
        endpoints: {
          '/upload': 'POST - Upload YouTube video to R2',
          '/list': 'GET - List all videos in R2',
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  },
};

/**
 * 下载并上传视频到 R2
 * 注意：由于 Worker 限制，实际下载应通过外部服务
 */
async function downloadAndUploadVideo(youtubeUrl, title, env) {
  // 方案1：调用外部下载服务
  const downloadService = 'https://your-download-service.com/api/download';

  // 这里需要实现：
  // 1. 调用下载服务获取视频
  // 2. 上传到 R2
  // 3. 返回公开 URL

  // 临时返回模拟数据
  const videoKey = `${slugify(title || 'video')}.mp4`;

  return {
    success: true,
    videoKey,
    videoUrl: `https://your-r2-public-url.com/${videoKey}`,
    message: 'Video uploaded successfully (mock)',
  };
}

/**
 * 生成 URL-slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}
