import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
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

  // Route protection uses a PUBLIC-route blocklist: everything is protected by
  // default, so newly added routes (e.g. /play, /scorecard, /seasons) are gated
  // automatically instead of silently falling through an allowlist.
  const pathname = request.nextUrl.pathname;
  const PUBLIC_PREFIXES = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/invite',
    '/auth', // auth callback / confirmation routes
  ];
  const isPublicRoute =
    pathname === '/' || // public landing page
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedRoute = !isPublicRoute;

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
      !pathname.startsWith('/invite') &&
      // /join completes the profile inline (saveJoinProfile) after the code, so
      // don't bounce new users to /settings before they can join a game.
      !pathname.startsWith('/join')
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
