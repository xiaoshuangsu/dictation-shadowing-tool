/**
 * Simple R2 Proxy Worker (for testing)
 * No image optimization, just serve files from R2
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Remove leading slash
      const key = path.startsWith('/') ? path.slice(1) : path;

      // Get object from R2
      const object = await env.R2.get(key);

      if (!object) {
        return new Response(`File not found: ${key}`, { status: 404 });
      }

      // Get headers
      const headers = new Headers();
      object.writeHttpMetadata(headers);

      // Add caching headers
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');

      return new Response(object.body, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Worker error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};
