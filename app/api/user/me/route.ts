// app/api/user/me/route.ts
// Get current user info

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canGenerate } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get generation limits
    const { remaining } = await canGenerate(user.id);

    // Return user data (excluding sensitive tokens)
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      generationsThisMonth: user.generationsThisMonth,
      generationsRemaining: remaining,
      channels: user.channels.map(ch => ({
        id: ch.id,
        youtubeId: ch.youtubeId,
        title: ch.title,
        thumbnailUrl: ch.thumbnailUrl,
        subscriberCount: ch.subscriberCount,
        videoCount: ch.videoCount,
        avgCtr: ch.avgCtr,
      })),
      hasYouTubeConnected: !!user.youtubeChannelId,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
