import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const user = token ? await verifyToken(token) : null

  if (pathname.startsWith('/api/')) {
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (user.role === 'demo' && !SAFE_METHODS.includes(req.method.toUpperCase())) {
      return NextResponse.json({ error: 'El usuario demo es de solo lectura' }, { status: 403 })
    }
    return NextResponse.next()
  }

  if (!user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user.role === 'demo' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
