# The Good Grief Journal

A compassionate AI-powered grief journaling app built with love — and with my mom.

## The Story

The Good Grief Journal was built as a family venture. My mother is a journaling expert and grief support specialist who spent years developing 775 carefully crafted prompts across 5 emotional categories. I'm a developer. Together we built something we hope will help people process loss in a gentle, meaningful way.

## Features

- **Guided journaling** — daily prompts across 5 categories: Sadness, Memories, Hard Emotions, Small Steps, and Acceptance
- **AI companion** — powered by Claude Haiku (Anthropic), responds to each entry with warmth and presence
- **Crisis detection** — keyword detection routes users to 988 Suicide & Crisis Lifeline when needed
- **Photo gallery** — upload and organize photos of loved ones with captions
- **Memory Book** — generates a beautiful downloadable PDF combining journal entries and photos
- **Secure by design** — Row Level Security on all tables, each user sees only their own data

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Anthropic Claude Haiku via @anthropic-ai/sdk
- **PDF Generation:** @react-pdf/renderer
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- An Anthropic API key

### Installation

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env.local` and fill in your values
4. Run `npx supabase db push` to apply migrations
5. Run `npm run dev`

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

## Database

11 tables with full RLS policies. Migrations are in `supabase/migrations/`.

## Payments

### Payments (Stripe)

The app uses Stripe for two products:
- **Monthly subscription** ($9.99/mo) — required to access the journal. Managed via `STRIPE_SUBSCRIPTION_PRICE_ID`.
- **Memory Book Unlock** ($27 one-time) — unlocks the PDF memory book feature. Managed via `STRIPE_MEMORY_BOOK_PRICE_ID`.

#### Environment variables required
```
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SUBSCRIPTION_PRICE_ID=price_...
STRIPE_MEMORY_BOOK_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

#### Local webhook forwarding
Install the Stripe CLI and run:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
This prints a webhook signing secret (`whsec_...`) — copy it into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

#### Stripe Dashboard setup
1. Create the two products in the Stripe Dashboard (or use existing ones).
2. Copy the price IDs into `STRIPE_SUBSCRIPTION_PRICE_ID` and `STRIPE_MEMORY_BOOK_PRICE_ID`.
3. Register the webhook endpoint (`https://yourdomain.com/api/stripe/webhook`) in the Stripe Dashboard under Developers → Webhooks. Select events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`.

#### Going live
Switch `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from `sk_test_`/`pk_test_` to live keys. Update `NEXT_PUBLIC_APP_URL` to your production domain.

## Built By

John Miller — Lead Data Architect and entrepreneur
In partnership with his mother, a grief journaling expert

---

*This project is part of the Brave Mill Ventures portfolio.*
