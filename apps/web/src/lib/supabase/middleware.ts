import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/home') ||
    request.nextUrl.pathname.startsWith('/groups') ||
    request.nextUrl.pathname.startsWith('/rounds') ||
    request.nextUrl.pathname.startsWith('/courses') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/admin');

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const fullPath = request.nextUrl.pathname + request.nextUrl.search;
    const safeRedirect = fullPath.startsWith('/') && !fullPath.startsWith('//') ? fullPath : '/home';
    url.searchParams.set('redirect', safeRedirect);
    return NextResponse.redirect(url);
  }

  // Profile completion redirect — new users must finish setup before using the app
  if (user && isProtectedRoute) {
    const profileCompleted = user.user_metadata?.profile_completed;
    const pathname = request.nextUrl.pathname;
    if (
      profileCompleted === false &&
      !pathname.startsWith('/settings') &&
      !pathname.startsWith('/invite')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/settings';
      url.searchParams.set('setup', 'true');
      return NextResponse.redirect(url);
    }
  }

  // Auth routes - redirect to home if already authenticated
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register');

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    const rawRedirect = request.nextUrl.searchParams.get('redirect') || '/home';
    url.pathname = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/home';
    url.searchParams.delete('redirect');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
