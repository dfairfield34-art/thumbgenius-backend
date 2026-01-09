# ThumbGenius Backend

AI-powered YouTube thumbnail generator with channel-specific learning.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Supabase + Prisma ORM
- **Auth**: YouTube OAuth 2.0 + JWT sessions
- **Payments**: Stripe subscriptions
- **AI**: Replicate (Flux model for image generation)
- **Deployment**: Vercel

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/youtube` | Initiate YouTube OAuth |
| GET | `/api/auth/youtube/callback` | OAuth callback handler |
| POST | `/api/auth/logout` | Logout user |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/me` | Get current user info |

### Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate` | Generate thumbnails |
| GET | `/api/generate` | Get available styles |
| GET | `/api/thumbnails` | Get thumbnail history |

### Channel
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/channel/sync` | Sync YouTube channel data |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/billing/checkout` | Create Stripe checkout |
| POST | `/api/billing/portal` | Open billing portal |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repo>
cd thumbgenius-backend
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

### 3. Google Cloud Setup (YouTube API)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Enable **YouTube Analytics API**
5. Go to **Credentials** → Create OAuth 2.0 Client ID
6. Set authorized redirect URI: `http://localhost:3000/api/auth/youtube/callback`
7. Copy Client ID and Secret to `.env.local`

### 4. Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings → Database → Connection string
3. Copy the URI to `DATABASE_URL` in `.env.local`
4. Copy project URL and anon key to env vars

### 5. Stripe Setup

1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Dashboard → Developers
3. Create a Product with $29/month price
4. Copy Price ID to `STRIPE_PRICE_ID_PRO`
5. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
6. Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`

### 6. Replicate Setup

1. Create account at [replicate.com](https://replicate.com)
2. Get API token from Settings
3. Copy to `REPLICATE_API_TOKEN`

### 7. Database Migration

```bash
npx prisma generate
npx prisma db push
```

### 8. Run Development Server

```bash
npm run dev
```

## API Usage Examples

### Generate Thumbnails

```javascript
// POST /api/generate
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Tech review of the new iPhone",
    style: "tech",
    videoTitle: "iPhone 16 Pro Review - Worth the Upgrade?",
    count: 4
  })
});

const { thumbnails, remaining } = await response.json();
// Returns: thumbnails with imageUrl, predictedCtr, confidence
```

### Sync Channel

```javascript
// POST /api/channel/sync
const response = await fetch('/api/channel/sync', {
  method: 'POST'
});

const { channel, syncedVideos } = await response.json();
```

### Upgrade to Pro

```javascript
// POST /api/billing/checkout
const response = await fetch('/api/billing/checkout', {
  method: 'POST'
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe
```

## Pricing Tiers

| Plan | Price | Generations/Month |
|------|-------|-------------------|
| Free | $0 | 2 |
| Pro | $29/mo | Unlimited |

## File Structure

```
thumbgenius-backend/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── youtube/
│       │   │   ├── route.ts        # OAuth initiate
│       │   │   └── callback/
│       │   │       └── route.ts    # OAuth callback
│       │   └── logout/
│       │       └── route.ts
│       ├── billing/
│       │   ├── checkout/
│       │   │   └── route.ts
│       │   └── portal/
│       │       └── route.ts
│       ├── channel/
│       │   └── sync/
│       │       └── route.ts
│       ├── generate/
│       │   └── route.ts
│       ├── thumbnails/
│       │   └── route.ts
│       ├── user/
│       │   └── me/
│       │       └── route.ts
│       └── webhooks/
│           └── stripe/
│               └── route.ts
├── lib/
│   ├── ai.ts           # Replicate integration
│   ├── auth.ts         # JWT & session handling
│   ├── db.ts           # Prisma client
│   ├── stripe.ts       # Stripe utilities
│   └── youtube.ts      # YouTube API utilities
├── prisma/
│   └── schema.prisma   # Database schema
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

## Deployment to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add all environment variables
4. Update OAuth redirect URI to production domain
5. Update Stripe webhook endpoint

```bash
vercel --prod
```

## License

MIT
