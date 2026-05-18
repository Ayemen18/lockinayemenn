import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  console.log('=== PROXY MIDDLEWARE START ===')
  console.log('Pathname:', req.nextUrl.pathname)
  console.log('Request Cookies:', req.cookies.getAll().map(c => c.name))

  if (req.nextUrl.pathname === '/dashboard/journal') {
    console.log('Redirecting /dashboard/journal to /journal')
    return NextResponse.redirect(new URL('/journal', req.url))
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          console.log('setAll in proxy called with cookies:', cookiesToSet.map(c => c.name))
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )
  
  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
    console.log('Proxy session exists:', !!session, session ? `User: ${session.user?.email}` : '')
  } catch (err) {
    console.error('Error fetching session in proxy:', err)
  }

  const isAuthPage = req.nextUrl.pathname === '/login'

  if (!session && !isAuthPage) {
    console.log('Redirecting unauthorized user from', req.nextUrl.pathname, 'to /login')
    const redirectRes = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie.name, cookie.value)
    })
    console.log('=== PROXY MIDDLEWARE END (REDIRECT TO LOGIN) ===')
    return redirectRes
  }

  if (session && isAuthPage) {
    console.log('Redirecting already authenticated user from /login to /home')
    const redirectRes = NextResponse.redirect(new URL('/home', req.url))
    res.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie.name, cookie.value)
    })
    console.log('=== PROXY MIDDLEWARE END (REDIRECT TO HOME) ===')
    return redirectRes
  }

  console.log('Allowing access to', req.nextUrl.pathname)
  console.log('=== PROXY MIDDLEWARE END (ALLOW) ===')
  return res
}

export const config = {
  matcher: ['/home/:path*', '/dashboard/:path*', '/journal/:path*', '/habits/:path*', '/login']
}