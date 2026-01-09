// lib/auth.ts
// Authentication utilities

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prisma from './db';

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = 'thumbgenius_token';

interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Create a JWT token for a user
 */
export function createToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email } as JWTPayload,
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Set auth cookie
 */
export function setAuthCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get current user from request
 */
export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      channels: true,
    },
  });
  
  return user;
}

/**
 * Get current user from cookies (for server components)
 */
export async function getServerUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      channels: true,
    },
  });
  
  return user;
}

/**
 * Check if user can generate (within limits)
 */
export async function canGenerate(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { allowed: false, remaining: 0 };
  }

  // Reset monthly count if needed
  const now = new Date();
  const resetDate = new Date(user.generationsResetAt);
  
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        generationsThisMonth: 0,
        generationsResetAt: now,
      },
    });
    user.generationsThisMonth = 0;
  }

  // Get limit based on plan
  const limit = user.plan === 'FREE' 
    ? parseInt(process.env.FREE_TIER_LIMIT || '2')
    : parseInt(process.env.PRO_TIER_LIMIT || '999999');

  const remaining = Math.max(0, limit - user.generationsThisMonth);
  
  return {
    allowed: user.generationsThisMonth < limit,
    remaining,
  };
}

/**
 * Increment user's generation count
 */
export async function incrementGenerations(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      generationsThisMonth: { increment: 1 },
    },
  });
}
