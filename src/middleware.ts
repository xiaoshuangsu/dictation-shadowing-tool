import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Handle /zh-CN routes - rewrite to root and set language
  if (pathname.startsWith('/zh-CN')) {
    const response = NextResponse.rewrite(
      new URL(pathname.replace('/zh-CN', '') || '/', request.url)
    )
    // Set language preference
    response.cookies.set('language', 'zh', { path: '/' })
    return response
  }

  // For root path, default to English
  if (pathname === '/') {
    const response = NextResponse.next()
    // Only set if not already set
    if (!request.cookies.get('language')) {
      response.cookies.set('language', 'en', { path: '/' })
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
