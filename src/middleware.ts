import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/server/session-edge';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/healthz'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    // API menjawab 401 supaya client bisa menanganinya; halaman diarahkan ke login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Lindungi semua rute kecuali aset statis.
  matcher: ['/((?!_next/static|_next/image|favicon.svg|branding|robots.txt).*)'],
};
