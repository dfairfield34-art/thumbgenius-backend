// app/api/auth/youtube/route.ts
// Initiate YouTube OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/youtube';
import { nanoid } from 'nanoid';

export async function GET(request: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = nanoid();
    
    // Store state in cookie for verification
    const authUrl = getAuthUrl(state);
    
    const response = NextResponse.redirect(authUrl);
    
    // Set state cookie
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`
    );
  }
}
