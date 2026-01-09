// app/api/auth/youtube/callback/route.ts
// Handle YouTube OAuth callback

import { NextRequest, NextResponse } from 'next/server';
import { getTokens, getGoogleProfile, getMyChannel } from '@/lib/youtube';
import { createToken, setAuthCookie } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=oauth_denied`
      );
    }

    // Verify code exists
    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=no_code`
      );
    }

    // Verify state (CSRF protection)
    const storedState = request.cookies.get('oauth_state')?.value;
    if (state !== storedState) {
      console.error('State mismatch:', { received: state, stored: storedState });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokens = await getTokens(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user's Google profile
    const profile = await getGoogleProfile(tokens.access_token);
    
    // Get user's YouTube channel
    const channel = await getMyChannel(tokens.access_token, tokens.refresh_token || undefined);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // Update existing user with new tokens
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name,
          image: profile.picture,
          youtubeAccessToken: tokens.access_token,
          youtubeRefreshToken: tokens.refresh_token || user.youtubeRefreshToken,
          youtubeTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          youtubeChannelId: channel?.id || user.youtubeChannelId,
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          youtubeAccessToken: tokens.access_token,
          youtubeRefreshToken: tokens.refresh_token || null,
          youtubeTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          youtubeChannelId: channel?.id || null,
        },
      });
    }

    // If user has a channel, create/update channel record
    if (channel) {
      await prisma.channel.upsert({
        where: { youtubeId: channel.id },
        update: {
          title: channel.title,
          description: channel.description,
          thumbnailUrl: channel.thumbnailUrl,
          subscriberCount: channel.subscriberCount,
          videoCount: channel.videoCount,
          viewCount: channel.viewCount,
          userId: user.id,
        },
        create: {
          youtubeId: channel.id,
          title: channel.title,
          description: channel.description,
          thumbnailUrl: channel.thumbnailUrl,
          subscriberCount: channel.subscriberCount,
          videoCount: channel.videoCount,
          viewCount: channel.viewCount,
          userId: user.id,
        },
      });
    }

    // Create JWT token
    const token = createToken(user.id, user.email);

    // Redirect to dashboard with auth cookie
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );
    
    // Set auth cookie
    response.cookies.set('thumbgenius_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Clear state cookie
    response.cookies.delete('oauth_state');

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`
    );
  }
}
