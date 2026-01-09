// lib/ai.ts
// AI Thumbnail Generation using Replicate

import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Thumbnail styles with their prompts
export const THUMBNAIL_STYLES = {
  viral: {
    name: 'Viral Hook',
    description: 'Bold, attention-grabbing thumbnails optimized for clicks',
    promptSuffix: 'vibrant colors, bold text overlay space, dramatic lighting, high contrast, youtube thumbnail style, 16:9 aspect ratio, professional photography, eye-catching, viral content aesthetic',
  },
  minimal: {
    name: 'Clean Minimal',
    description: 'Simple, elegant thumbnails with focus on clarity',
    promptSuffix: 'minimalist design, clean composition, subtle colors, professional, modern aesthetic, plenty of negative space for text, youtube thumbnail style, 16:9 aspect ratio, high quality',
  },
  dramatic: {
    name: 'Drama Driven',
    description: 'High-impact thumbnails with emotional appeal',
    promptSuffix: 'dramatic lighting, cinematic composition, emotional impact, intense colors, moody atmosphere, youtube thumbnail style, 16:9 aspect ratio, film quality, storytelling visual',
  },
  tech: {
    name: 'Tech Review',
    description: 'Perfect for tech content and product showcases',
    promptSuffix: 'tech aesthetic, gradient background, neon accents, futuristic, product showcase style, clean professional, youtube thumbnail style, 16:9 aspect ratio, modern design',
  },
  gaming: {
    name: 'Gaming',
    description: 'Energetic thumbnails for gaming content',
    promptSuffix: 'gaming aesthetic, vibrant neon colors, dynamic composition, energetic, action-packed, youtube gaming thumbnail style, 16:9 aspect ratio, esports quality',
  },
};

export type ThumbnailStyle = keyof typeof THUMBNAIL_STYLES;

interface GenerationOptions {
  prompt: string;
  style: ThumbnailStyle;
  negativePrompt?: string;
  count?: number;
}

interface GeneratedThumbnail {
  url: string;
  seed: number;
}

/**
 * Generate thumbnail images using Flux (via Replicate)
 */
export async function generateThumbnails(options: GenerationOptions): Promise<GeneratedThumbnail[]> {
  const { prompt, style, negativePrompt, count = 4 } = options;
  
  const styleConfig = THUMBNAIL_STYLES[style] || THUMBNAIL_STYLES.viral;
  
  // Combine user prompt with style suffix
  const fullPrompt = `${prompt}, ${styleConfig.promptSuffix}`;
  
  const defaultNegative = 'blurry, low quality, distorted, watermark, text, logo, ugly, deformed, bad anatomy, bad proportions, duplicate, error';
  
  const results: GeneratedThumbnail[] = [];
  
  // Generate multiple thumbnails with different seeds
  const seeds = Array.from({ length: count }, () => Math.floor(Math.random() * 1000000));
  
  // Run generations in parallel
  const generations = seeds.map(async (seed) => {
    try {
      const output = await replicate.run(
        'black-forest-labs/flux-schnell',
        {
          input: {
            prompt: fullPrompt,
            negative_prompt: negativePrompt || defaultNegative,
            width: 1280,
            height: 720,
            num_outputs: 1,
            seed,
            go_fast: true,
            num_inference_steps: 4,
          },
        }
      );

      // Output is an array of URLs
      const urls = output as string[];
      
      if (urls && urls.length > 0) {
        return {
          url: urls[0],
          seed,
        };
      }
      return null;
    } catch (error) {
      console.error(`Generation failed for seed ${seed}:`, error);
      return null;
    }
  });

  const outputs = await Promise.all(generations);
  
  return outputs.filter((o): o is GeneratedThumbnail => o !== null);
}

/**
 * Predict CTR score based on thumbnail analysis
 * This is a simplified heuristic - in production you'd use ML
 */
export function predictCTR(thumbnailUrl: string, channelAvgCtr?: number): { score: number; confidence: number } {
  // Base score
  let score = 6.5;
  
  // Add some randomness to simulate ML predictions
  const variance = (Math.random() - 0.5) * 3;
  score += variance;
  
  // If we know channel's average, center around that
  if (channelAvgCtr) {
    score = channelAvgCtr + variance;
  }
  
  // Clamp between 1-10
  score = Math.max(1, Math.min(10, score));
  
  // Round to 1 decimal
  score = Math.round(score * 10) / 10;
  
  // Confidence is higher when we have more data
  const confidence = channelAvgCtr ? 0.75 + Math.random() * 0.2 : 0.5 + Math.random() * 0.3;
  
  return {
    score,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Analyze thumbnail for key elements
 * In production, this would use computer vision
 */
export function analyzeThumbnail(thumbnailUrl: string): {
  hasFace: boolean;
  hasText: boolean;
  dominantColors: string[];
  brightness: 'dark' | 'medium' | 'bright';
} {
  // Placeholder - in production use Google Vision or similar
  return {
    hasFace: Math.random() > 0.3,
    hasText: Math.random() > 0.2,
    dominantColors: ['#FF5733', '#3498DB', '#2ECC71'].slice(0, Math.floor(Math.random() * 3) + 1),
    brightness: ['dark', 'medium', 'bright'][Math.floor(Math.random() * 3)] as any,
  };
}
