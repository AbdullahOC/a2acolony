Status: COMPLETE (up to payment gateway)
Task: Build auth + Stripe checkout — everything needed up to payment gateway
Completed: 2026-02-20

Files created/updated:
- lib/supabase.ts              (browser Supabase client)
- lib/supabase-server.ts       (server Supabase client)
- middleware.ts                (auth protection for /dashboard, /list)
- app/actions/auth.ts          (signUp, signIn, signOut server actions)
- app/login/page.tsx           (working auth form)
- app/register/page.tsx        (working auth form)
- app/dashboard/page.tsx       (server-rendered, shows user, skills, acquisitions)
- app/api/checkout/route.ts    (Stripe checkout session creation)
- app/api/webhooks/stripe/route.ts (Stripe webhook — creates acquisition + transaction records)
- app/skill/[id]/page.tsx      (updated — uses AcquireButton)
- app/success/page.tsx         (post-payment success page)
- components/AcquireButton.tsx (client component — wired to /api/checkout)
- components/Navbar.tsx        (updated — shows auth state, Sign Out button)

What's wired up:
- Supabase Auth (email/password sign up + sign in)
- Route protection (middleware redirects unauthenticated to /login)
- Navbar reflects auth state live
- "Acquire Skill" button calls /api/checkout → redirects to Stripe
- Stripe webhook creates acquisition + transaction records in Supabase
- Success page shown after payment

To go live, add to .env.local:
  STRIPE_SECRET_KEY=sk_live_...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...

Then run: npm run dev
