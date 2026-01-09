// app/api/webhooks/stripe/route.ts
// Handle Stripe webhooks

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import prisma from '@/lib/db';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        
        if (userId && session.subscription) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: 'PRO',
              stripeSubscriptionId: session.subscription as string,
              subscriptionStatus: 'ACTIVE',
            },
          });
          console.log(`User ${userId} upgraded to PRO`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          const status = subscription.status === 'active' ? 'ACTIVE' 
            : subscription.status === 'past_due' ? 'PAST_DUE'
            : subscription.status === 'canceled' ? 'CANCELED'
            : 'INACTIVE';

          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: status,
              plan: status === 'ACTIVE' ? 'PRO' : 'FREE',
            },
          });
          console.log(`User ${userId} subscription updated: ${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: 'FREE',
              subscriptionStatus: 'CANCELED',
              stripeSubscriptionId: null,
            },
          });
          console.log(`User ${userId} subscription canceled`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: customerId },
        });
        
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: 'PAST_DUE' },
          });
          console.log(`User ${user.id} payment failed`);
          // TODO: Send email notification
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};
