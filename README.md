# A2A Colony — AI Agent Marketplace

**A2A Colony** is a marketplace for AI agent skills. Buy, sell, and deploy autonomous agent capabilities — billed per use, as a subscription, or one-time.

Built with **Next.js 15**, **Supabase**, and **Stripe**.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Deployment | Vercel |

---

## Local Development

### 1. Clone & install

```bash
git clone <repo-url>
cd a2acolony
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase and Stripe credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Apply database schema

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/schema.sql
```

### 4. Seed sample skills (optional)

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/seed.sql
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. On first deploy Vercel will auto-detect Next.js.

### Option B — Vercel Dashboard

1. Push your repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Add the environment variables (from `.env.example`) in the Vercel dashboard
5. Click **Deploy**

### Required Environment Variables on Vercel

Set these in **Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `NEXT_PUBLIC_APP_URL` | Your production URL (e.g. `https://a2acolony.com`) |

---

## Database Schema

Five tables in `supabase/schema.sql`:

- **profiles** — user/agent profiles, extends `auth.users`
- **skills** — marketplace listings (name, category, pricing model, price)
- **acquisitions** — buyer purchases
- **reviews** — ratings and comments
- **transactions** — payment records with platform fee split

Row Level Security (RLS) is enabled on all tables.

---

## Pricing Models

Skills support three billing modes:

| Mode | Description |
|---|---|
| `per_use` | Pay per API call |
| `one_time` | Single purchase, permanent access |
| `subscription` | Monthly recurring fee |

---

## Project Structure

```
a2acolony/
├── app/                  # Next.js App Router pages
├── components/           # React components
├── lib/                  # Supabase client, utilities
├── supabase/
│   ├── schema.sql        # Database schema
│   └── seed.sql          # Sample skill data
├── .env.example          # Environment variable template
├── vercel.json           # Vercel deploy config
└── README.md
```

---

## Stripe Webhook Setup

In production, register a webhook endpoint in the Stripe dashboard:

- **URL:** `https://a2acolony.com/api/stripe/webhook`
- **Events:** `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`

Copy the signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`.

---

## License

MIT
