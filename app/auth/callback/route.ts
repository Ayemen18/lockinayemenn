import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  console.log('--- AUTH CALLBACK INITIATED ---')
  console.log('URL:', request.url)
  console.log('Code present:', !!code)

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            console.log('setAll called in callback with cookies:', cookiesToSet.map(c => c.name))
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (err) {
              console.error('Error in setAll callback:', err)
            }
          },
        },
      }
    )

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      console.log('Code exchange result error:', error)
      console.log('Code exchange session user:', data.user?.email)
    } catch (err) {
      console.error('Exception during exchangeCodeForSession:', err)
    }
  } else {
    console.log('No code found in search params')
  }

  console.log('Redirecting to dashboard...')
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}