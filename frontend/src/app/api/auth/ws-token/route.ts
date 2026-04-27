import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/ws-token
 *
 * Returns the access_token from the httpOnly cookie as a JSON body.
 * Used exclusively by GlobalUnreadWS to obtain a token that can be passed
 * as a ?token= query parameter on the WebSocket upgrade request, since the
 * browser WebSocket API cannot set custom headers.
 *
 * Security: this endpoint is only callable from the same origin (SameSite
 * cookie policy), so it does not widen the attack surface beyond the existing
 * httpOnly cookie.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ token })
}
