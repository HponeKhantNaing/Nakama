import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { getDashboardForRole, canAccessRoute, isPublicRoute } from '@/lib/rbac';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (pathname.startsWith('/api/')) {
      if (
        isPublicRoute(pathname) ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/delivery/confirm') ||
        pathname.startsWith('/api/confirm') ||
        pathname.startsWith('/api/yokomochi/confirm')
      ) {
        return NextResponse.next();
      }
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.next();
    }

    if (pathname === '/') {
      if (token?.role) {
        return NextResponse.redirect(new URL(getDashboardForRole(token.role), req.url));
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (isPublicRoute(pathname)) {
      if (token && pathname === '/login') {
        return NextResponse.redirect(new URL(getDashboardForRole(token.role), req.url));
      }
      return NextResponse.next();
    }

    if (!token?.role) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!canAccessRoute(token.role, pathname)) {
      return NextResponse.redirect(new URL(getDashboardForRole(token.role), req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith('/api/')) return true;
        if (isPublicRoute(pathname) || pathname.startsWith('/api/auth')) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/warehouse',
    '/warehouse/:path*',
    '/factory',
    '/factory/:path*',
    '/carrier',
    '/carrier/:path*',
    '/maruichi/:path*',
    '/shinwa/:path*',
    '/subcontractor/:path*',
    '/driver/:path*',
    '/delivery/confirm/:path*',
    '/confirm/:path*',
    '/api/transport/:path*',
    '/api/notifications/:path*',
    '/api/upload/:path*',
    '/api/gps/:path*',
    '/api/products/:path*',
    '/api/trucks/:path*',
    '/api/delivery/:path*',
    '/api/analytics/:path*',
    '/api/negotiation/:path*',
  ],
};
