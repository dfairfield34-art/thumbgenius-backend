// app/api/billing/checkout/route.ts
// Create Stripe checkout session

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createCustomer, createCheckoutSession } from '@/lib/stripe';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already Pro
    if (user.plan === 'PRO' && user.subscriptionStatus === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Already subscribed to Pro' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      customerId = await createCustomer(user.email, user.name || undefined);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const checkoutUrl = await createCheckoutSession(customerId, user.id);

    return NextResponse.json({ url: checkoutUrl });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
