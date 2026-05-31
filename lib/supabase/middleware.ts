import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = [
  '/',
  '/login',
  '/book-demo',
  '/api/logout',
]

function isPublicPath(pathname: string) {
  if (publicPaths.includes(pathname)) return true
  if (pathname.startsWith('/book-demo')) return true
  return false
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && request.nextUrl.pathname !== '/change-password') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.must_change_password && !isPublicPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/change-password'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
