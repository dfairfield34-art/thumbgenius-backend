// app/api/channel/sync/route.ts
// Sync YouTube channel data

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMyChannel, getChannelVideos, getVideoStats, refreshAccessToken } from '@/lib/youtube';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.youtubeAccessToken) {
      return NextResponse.json(
        { error: 'YouTube not connected' },
        { status: 400 }
      );
    }

    let accessToken = user.youtubeAccessToken;

    // Check if token needs refresh
    if (user.youtubeTokenExpiry && new Date() >= user.youtubeTokenExpiry) {
      if (!user.youtubeRefreshToken) {
        return NextResponse.json(
          { error: 'Token expired, please reconnect YouTube' },
          { status: 401 }
        );
      }

      const refreshed = await refreshAccessToken(user.youtubeRefreshToken);
      accessToken = refreshed.accessToken;

      // Update user's tokens
      await prisma.user.update({
        where: { id: user.id },
        data: {
          youtubeAccessToken: refreshed.accessToken,
          youtubeTokenExpiry: refreshed.expiryDate,
        },
      });
    }

    // Get channel info
    const channelInfo = await getMyChannel(accessToken, user.youtubeRefreshToken || undefined);
    
    if (!channelInfo) {
      return NextResponse.json(
        { error: 'No YouTube channel found' },
        { status: 404 }
      );
    }

    // Update or create channel
    const channel = await prisma.channel.upsert({
      where: { youtubeId: channelInfo.id },
      update: {
        title: channelInfo.title,
        description: channelInfo.description,
        thumbnailUrl: channelInfo.thumbnailUrl,
        subscriberCount: channelInfo.subscriberCount,
        videoCount: channelInfo.videoCount,
        viewCount: channelInfo.viewCount,
        lastAnalyzedAt: new Date(),
      },
      create: {
        youtubeId: channelInfo.id,
        title: channelInfo.title,
        description: channelInfo.description,
        thumbnailUrl: channelInfo.thumbnailUrl,
        subscriberCount: channelInfo.subscriberCount,
        videoCount: channelInfo.videoCount,
        viewCount: channelInfo.viewCount,
        userId: user.id,
        lastAnalyzedAt: new Date(),
      },
    });

    // Fetch videos if we have uploads playlist
    let videoCount = 0;
    if (channelInfo.uploadsPlaylistId) {
      const videos = await getChannelVideos(accessToken, channelInfo.uploadsPlaylistId, 50);
      
      // Get video stats
      const videoIds = videos.map(v => v.youtubeId).filter(Boolean);
      const stats = await getVideoStats(accessToken, videoIds);

      // Upsert videos
      for (const video of videos) {
        if (!video.youtubeId) continue;
        
        const videoStats = stats[video.youtubeId] || {};
        
        await prisma.video.upsert({
          where: { youtubeId: video.youtubeId },
          update: {
            title: video.title,
            description: video.description,
            publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
            currentThumbnailUrl: video.thumbnailUrl,
            viewCount: videoStats.viewCount || BigInt(0),
            likeCount: videoStats.likeCount || 0,
            commentCount: videoStats.commentCount || 0,
          },
          create: {
            youtubeId: video.youtubeId,
            title: video.title,
            description: video.description,
            publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
            currentThumbnailUrl: video.thumbnailUrl,
            viewCount: videoStats.viewCount || BigInt(0),
            likeCount: videoStats.likeCount || 0,
            commentCount: videoStats.commentCount || 0,
            channelId: channel.id,
          },
        });
        
        videoCount++;
      }
    }

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        youtubeId: channel.youtubeId,
        title: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
        subscriberCount: channel.subscriberCount,
        videoCount: channel.videoCount,
      },
      syncedVideos: videoCount,
    });

  } catch (error) {
    console.error('Channel sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
