/**
 * Cloudflare Worker for R2 Image Optimization (Simplified Version)
 *
 * This version uses Cloudflare Images API which is simpler and more efficient
 *
 * Setup Instructions:
 * 1. Go to Cloudflare Dashboard > Workers & Pages
 * 2. Create a new Worker (or edit existing r2-proxy worker)
 * 3. Add R2 bucket binding: Variable name = R2, Bucket name = your-bucket-name
 * 4. Copy this script to the Worker editor
 * 5. Deploy
 *
 * Features:
 * - WebP conversion based on Accept header
 * - Dynamic resizing with ?width=400
 * - Quality setting to 75
 * - Strong caching (1 year edge cache, 7 days browser cache)
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Extract object key from path
      const key = path.startsWith('/') ? path.slice(1) : path;

      // Get query parameters for image optimization
      const widthParam = url.searchParams.get('width');
      const qualityParam = url.searchParams.get('quality');

      // Check if this is an image request
      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(key);

      if (!isImage) {
        // For non-image files, serve directly from R2
        return await serveFromR2(env.R2, key, request, false);
      }

      // For images, apply optimization
      const width = widthParam ? parseInt(widthParam) : null;
      const quality = qualityParam ? parseInt(qualityParam) : 75; // Default quality: 75

      // Check WebP support
      const supportsWebP = request.headers.get('Accept')?.includes('image/webp');
      const format = supportsWebP ? 'webp' : 'jpeg';

      // Generate cache key
      const cacheKey = `${key}_w${width || 'auto'}_q${quality}_${format}`;

      // Check Cloudflare Cache (automatic for GET requests)
      // First, try to serve from R2 with optimization
      return await serveOptimizedImage(env.R2, env.IMAGES, key, {
        width,
        quality,
        format,
        originalRequest: request,
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Serve optimized image using Cloudflare Images API
 */
async function serveOptimizedImage(r2Bucket, imagesService, key, options) {
  const { width, quality, format, originalRequest } = options;

  // Get object from R2
  const object = await r2Bucket.get(key);

  if (!object) {
    return new Response('Image not found', { status: 404 });
  }

  // Method 1: Using Cloudflare Images (Recommended)
  if (imagesService) {
    try {
      // Create image URL for Cloudflare Images
      const imageUrl = new URL(`https://${object.key}`); // Use object.key or construct proper URL

      // Build resize options
      const resizeOptions = {
        width: width,
        quality: quality,
        format: format,
        fit: 'scale-down', // Don't upscale
      };

      // Get optimized URL from Cloudflare Images
      // Note: This requires Cloudflare Images to be enabled on your account
      // The image source needs to be accessible from Cloudflare
      const optimizedUrl = imagesService.createUrl(imageUrl.toString(), resizeOptions);

      // Fetch the optimized image
      const response = await fetch(optimizedUrl);

      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();

        // Return optimized image with caching headers
        return new Response(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': `image/${format}`,
            'Content-Length': imageBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
            'Vary': 'Accept', // Cache separately for WebP vs non-WebP
            'X-Content-Type-Options': 'nosniff',
          }
        });
      }
    } catch (error) {
      console.error('Cloudflare Images error:', error);
      // Fall through to Method 2
    }
  }

  // Method 2: Direct serve from R2 (fallback)
  // If Cloudflare Images is not available or fails, serve original
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // Add caching headers even for original images
  headers.set('Cache-Control', 'public, max-age=604800'); // 7 days

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

/**
 * Serve non-image files directly from R2
 */
async function serveFromR2(r2Bucket, key, request, isImage) {
  const object = await r2Bucket.get(key);

  if (!object) {
    return new Response('File not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // Add caching headers
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Set CORS if needed
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

/**
 * Handle CORS preflight requests
 */
export async function onRequestOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    }
  });
}
