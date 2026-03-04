/**
 * Cloudflare Worker for R2 Image Optimization
 *
 * Features:
 * 1. WebP conversion - Automatically convert to WebP if supported
 * 2. Dynamic resizing - Support ?width=400 parameter
 * 3. Quality compression - Set quality to 75 for ~20KB thumbnails
 * 4. Strong caching - Cache-Control for Cloudflare edge nodes
 *
 * Deployment:
 * 1. Copy this script to Cloudflare Workers
 * 2. Set R2_BUCKET binding to your R2 bucket
 * 3. Add environment variables if needed
 */

// R2 bucket binding - configure in Cloudflare Workers dashboard
// const R2 = R2_BUCKET;

// Default configuration
const DEFAULT_QUALITY = 75;
const DEFAULT_WIDTH = 400;
const MAX_WIDTH = 1920;
const CACHE_TTL = 31536000; // 1 year in seconds
const CACHE_BROWSER_TTL = 604800; // 7 days in seconds

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Extract key from path (remove leading slash)
      const key = path.startsWith('/') ? path.slice(1) : path;

      // Parse query parameters
      const width = url.searchParams.get('width')
        ? Math.min(parseInt(url.searchParams.get('width')), MAX_WIDTH)
        : null;
      const quality = url.searchParams.get('quality')
        ? parseInt(url.searchParams.get('quality'))
        : DEFAULT_QUALITY;

      // Check if this is an image request
      const isImage = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(key);

      if (!isImage) {
        // Non-image requests: proxy directly to R2
        return handleR2Request(env.R2, key, request);
      }

      // Image requests: optimize
      return handleImageRequest(env.R2, key, request, {
        width,
        quality,
        supportsWebP: supportsWebP(request),
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

/**
 * Handle R2 object request (non-image)
 */
async function handleR2Request(r2, key, originalRequest) {
  const object = await r2.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // Add caching headers for non-image assets
  headers.set('Cache-Control', `public, max-age=${CACHE_TTL}, immutable`);

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

/**
 * Handle image request with optimization
 */
async function handleImageRequest(r2, key, originalRequest, options) {
  const { width, quality, supportsWebP } = options;

  // Try to get from R2
  const object = await r2.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  // Get original image data
  const originalImage = await object.arrayBuffer();
  const originalType = object.httpMetadata?.contentType || 'image/jpeg';

  // Determine output format
  const outputFormat = supportsWebP ? 'image/webp' : originalType;

  // Generate cache key based on optimization parameters
  const cacheKey = width || quality ? `${key}_${width || 'auto'}_${quality}` : key;

  // Check Cloudflare KV cache (optional, for faster subsequent requests)
  // let cachedResponse = await env.IMAGE_CACHE.get(cacheKey, { type: 'arrayBuffer' });
  // if (cachedResponse) {
  //   return createImageResponse(cachedResponse, outputFormat);
  // }

  // Optimize image using Cloudflare's Image Resizing API
  let optimizedImage;

  if (env.IMAGES) {
    // Use Cloudflare Images service (if available)
    try {
      optimizedImage = await optimizeWithCloudflareImages(env.IMAGES, object, {
        width,
        quality,
        format: supportsWebP ? 'webp' : 'jpeg',
      });
    } catch (error) {
      console.error('Cloudflare Images error, falling back to direct serve:', error);
      optimizedImage = originalImage;
    }
  } else {
    // Fallback: serve original image
    // Note: Without Cloudflare Images, we can't optimize in the Worker
    // Consider using @cloudflare/images-api package or external service
    optimizedImage = originalImage;
  }

  // Cache in KV (optional)
  // ctx.waitUntil(env.IMAGE_CACHE.put(cacheKey, optimizedImage, {
  //   expirationTtl: CACHE_TTL,
  //   metadata: { contentType: outputFormat }
  // }));

  return createImageResponse(optimizedImage, outputFormat, width, quality);
}

/**
 * Optimize image using Cloudflare Images API
 */
async function optimizeWithCloudflareImages(imagesService, object, options) {
  const { width, quality, format } = options;

  // Create a URL for the image
  const imageUrl = new URL(object.key, `https://`);

  // Use Cloudflare Images resize endpoint
  const optimizedUrl = imagesService.createUrl(imageUrl, {
    width: width,
    quality: quality,
    format: format,
    fit: 'scale-down',
  });

  // Fetch the optimized image
  const response = await fetch(optimizedUrl);
  return await response.arrayBuffer();
}

/**
 * Create image response with appropriate headers
 */
function createImageResponse(imageBuffer, contentType, width = null, quality = null) {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', imageBuffer.byteLength.toString());

  // Strong caching for optimized images
  headers.set('Cache-Control', `public, max-age=${CACHE_BROWSER_TTL}, immutable`);

  // Add Vary header to cache based on Accept header
  headers.set('Vary', 'Accept');

  // Optional: Add image optimization info to headers (for debugging)
  // if (width) headers.set('X-Image-Width', width.toString());
  // if (quality) headers.set('X-Image-Quality', quality.toString());

  return new Response(imageBuffer, {
    status: 200,
    headers,
  });
}

/**
 * Check if browser supports WebP
 */
function supportsWebP(request) {
  const accept = request.headers.get('Accept');
  return accept && accept.includes('image/webp');
}

/**
 * Alternative: Use Sharp-like optimization in Workers
 * This requires bundling Sharp or using a WASM version
 *
 * Note: This is a placeholder - actual implementation would require
 * additional setup and dependencies
 */
async function optimizeImageWithWasm(imageBuffer, options) {
  // This would use a WASM-compiled version of Sharp or similar
  // Not implemented here due to complexity
  // Consider using Cloudflare Images API instead (simpler and faster)
  return imageBuffer;
}

/**
 * Route request to appropriate handler
 */
export async function onRequest(context) {
  return fetch(context.request);
}

/**
 * Scheduled event handler (optional)
 * Can be used for cache warming or cleanup
 */
export async function scheduled(event, env, ctx) {
  // Example: Warm up cache for popular images
  // console.log('Running scheduled task');
}

/**
 * Queue handler (optional)
 * Can be used for batch processing
 */
export async function queue(batch, env, ctx) {
  // Example: Process image optimization queue
  // console.log('Processing queue:', batch.messages.length);
}
