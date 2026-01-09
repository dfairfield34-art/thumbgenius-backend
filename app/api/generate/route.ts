// app/api/generate/route.ts
// Generate thumbnails using AI

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, canGenerate, incrementGenerations } from '@/lib/auth';
import { generateThumbnails, predictCTR, THUMBNAIL_STYLES, ThumbnailStyle } from '@/lib/ai';
import prisma from '@/lib/db';
import { z } from 'zod';

// Request validation schema
const generateSchema = z.object({
  prompt: z.string().min(3).max(500),
  style: z.enum(['viral', 'minimal', 'dramatic', 'tech', 'gaming']).default('viral'),
  videoTitle: z.string().optional(),
  count: z.number().min(1).max(8).default(4),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check generation limits
    const { allowed, remaining } = await canGenerate(user.id);
    if (!allowed) {
      return NextResponse.json(
        { 
          error: 'Generation limit reached',
          message: 'Upgrade to Pro for unlimited generations',
          remaining: 0,
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = generateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { prompt, style, videoTitle, count } = validation.data;

    // Get user's channel for CTR context
    const channel = user.channels[0];

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        prompt,
        style,
        videoTitle,
        thumbnailCount: count,
        status: 'PROCESSING',
        userId: user.id,
      },
    });

    try {
      // Generate thumbnails
      const generated = await generateThumbnails({
        prompt,
        style: style as ThumbnailStyle,
        count,
      });

      if (generated.length === 0) {
        throw new Error('No thumbnails generated');
      }

      // Create thumbnail records with CTR predictions
      const thumbnails = await Promise.all(
        generated.map(async (thumb) => {
          const prediction = predictCTR(thumb.url, channel?.avgCtr || undefined);
          
          return prisma.thumbnail.create({
            data: {
              imageUrl: thumb.url,
              prompt,
              style,
              predictedCtr: prediction.score,
              confidenceScore: prediction.confidence,
              status: 'GENERATED',
              userId: user.id,
              generationId: generation.id,
            },
          });
        })
      );

      // Sort by predicted CTR (highest first)
      thumbnails.sort((a, b) => (b.predictedCtr || 0) - (a.predictedCtr || 0));

      // Update generation status
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Increment user's generation count
      await incrementGenerations(user.id);

      return NextResponse.json({
        success: true,
        generationId: generation.id,
        thumbnails: thumbnails.map(t => ({
          id: t.id,
          imageUrl: t.imageUrl,
          predictedCtr: t.predictedCtr,
          confidence: t.confidenceScore,
          style: t.style,
        })),
        remaining: remaining - 1,
      });

    } catch (genError) {
      // Update generation as failed
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          error: genError instanceof Error ? genError.message : 'Unknown error',
        },
      });

      throw genError;
    }

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Generation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: Get available styles
export async function GET() {
  return NextResponse.json({
    styles: Object.entries(THUMBNAIL_STYLES).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
    })),
  });
}
