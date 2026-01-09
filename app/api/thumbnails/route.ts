// app/api/thumbnails/route.ts
// Get user's generated thumbnails

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Get thumbnails with pagination
    const [thumbnails, total] = await Promise.all([
      prisma.thumbnail.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          generation: {
            select: {
              prompt: true,
              videoTitle: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.thumbnail.count({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({
      thumbnails: thumbnails.map(t => ({
        id: t.id,
        imageUrl: t.imageUrl,
        predictedCtr: t.predictedCtr,
        confidence: t.confidenceScore,
        style: t.style,
        status: t.status,
        isSelected: t.isSelected,
        createdAt: t.createdAt,
        prompt: t.generation.prompt,
        videoTitle: t.generation.videoTitle,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Get thumbnails error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thumbnails' },
      { status: 500 }
    );
  }
}
