import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

function hashPassword(pw: string): string {
  return createHash('sha256')
    .update(pw + (process.env.AUTH_SECRET ?? 'httparchive-insights'))
    .digest('hex')
}

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const expected = hashPassword(process.env.SITE_PASSWORD ?? '')

  if (!password || hashPassword(password) !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_session', expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('auth_session')
  return response
}
