// lib/youtube.ts
// YouTube OAuth and Data API utilities

import { google, youtube_v3 } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
);

// Scopes needed for ThumbGenius
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Generate YouTube OAuth URL
 */
export function getAuthUrl(state?: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state || '',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Create authenticated YouTube client
 */
export function getYouTubeClient(accessToken: string, refreshToken?: string): youtube_v3.Youtube {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.youtube({ version: 'v3', auth });
}

/**
 * Get user's YouTube channel info
 */
export async function getMyChannel(accessToken: string, refreshToken?: string) {
  const youtube = getYouTubeClient(accessToken, refreshToken);
  
  const response = await youtube.channels.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    mine: true,
  });

  const channel = response.data.items?.[0];
  if (!channel) return null;

  return {
    id: channel.id!,
    title: channel.snippet?.title || '',
    description: channel.snippet?.description || '',
    thumbnailUrl: channel.snippet?.thumbnails?.high?.url || '',
    subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
    videoCount: parseInt(channel.statistics?.videoCount || '0'),
    viewCount: BigInt(channel.statistics?.viewCount || '0'),
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || null,
  };
}

/**
 * Get channel's videos with thumbnails
 */
export async function getChannelVideos(
  accessToken: string,
  playlistId: string,
  maxResults: number = 50
) {
  const youtube = getYouTubeClient(accessToken);
  const videos: any[] = [];
  let pageToken: string | undefined;

  do {
    const response = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: Math.min(maxResults - videos.length, 50),
      pageToken,
    });

    const items = response.data.items || [];
    
    for (const item of items) {
      videos.push({
        youtubeId: item.contentDetails?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        publishedAt: item.snippet?.publishedAt,
        thumbnailUrl: item.snippet?.thumbnails?.maxres?.url || 
                      item.snippet?.thumbnails?.high?.url ||
                      item.snippet?.thumbnails?.default?.url,
      });
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && videos.length < maxResults);

  return videos;
}

/**
 * Get video statistics (views, likes, etc.)
 */
export async function getVideoStats(accessToken: string, videoIds: string[]) {
  const youtube = getYouTubeClient(accessToken);
  
  // YouTube API allows max 50 IDs per request
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const allStats: Record<string, any> = {};

  for (const chunk of chunks) {
    const response = await youtube.videos.list({
      part: ['statistics'],
      id: chunk,
    });

    for (const video of response.data.items || []) {
      allStats[video.id!] = {
        viewCount: BigInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        commentCount: parseInt(video.statistics?.commentCount || '0'),
      };
    }
  }

  return allStats;
}

/**
 * Get user's Google profile info
 */
export async function getGoogleProfile(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  const oauth2 = google.oauth2({ version: 'v2', auth });
  const { data } = await oauth2.userinfo.get();
  
  return {
    email: data.email!,
    name: data.name || null,
    picture: data.picture || null,
  };
}

/**
 * Refresh access token if expired
 */
export async function refreshAccessToken(refreshToken: string) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return {
    accessToken: credentials.access_token!,
    expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}
