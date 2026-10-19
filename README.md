This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Ceasefire tracking: Realtime Database and external cron

Ceasefire state is stored server-side in the Realtime Database `/ceasefire` path.
Each child key is a kingdom ID such as `1-9`, with numeric `warsConcluded`,
numeric `timestamp` (Unix milliseconds), and boolean `isCeasefire` fields.
The provinces page continues to use its existing Firebase Realtime Database.

1. Use your existing Realtime Database in your Firebase project. Keep client
   access to the `ceasefire` collection denied; these routes use server credentials.
2. Follow the [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
   to obtain a service account with Realtime Database access. Set `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env.local` and your
   deployment environment. Set `FIREBASE_DATABASE_URL` to your database URL, or
   use the existing `NEXT_PUBLIC_FIREBASE_DB_URL`. `.env.example` shows the format; escaped `\n` in the
   private key is supported. Never prefix these secrets with `NEXT_PUBLIC_`.
3. Set `CRON_SECRET` to a long random value and redeploy.
4. In your external scheduler, call `https://YOUR_DOMAIN/api/cron-ceasefire`
   using GET or POST with header `Authorization: Bearer YOUR_CRON_SECRET`.
   Run hourly shortly after the game publishes its tick (for example `5 * * * *`
   if it publishes at the top of the hour). Avoid overlapping runs and retry
   failed requests. A successful response includes `success`, `updated`, and
   `deleted` counts. The endpoint fails closed when the secret is missing.

`vercel.json` has no cron schedules. After deploying, check the Vercel dashboard
and disable any old schedules still configured there and remove the old external
Supabase keepalive job, if present. `/api/supabase-keepalive` has been removed.
Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from local/deployment
configuration after exporting any state you need.

To preserve existing ceasefires, export the old deployment's `GET /api/ceasefire`
response before switching, then send only its `data` object as JSON to the new
deployment's `PATCH /api/ceasefire` with the same bearer header and
`Content-Type: application/json`. Import before enabling the scheduler.
Alternatively, the first cron invocation seeds current war counts with no active
ceasefires; only subsequent war-count increases start tracked ceasefires.
Existing data is not automatically copied from the old database.

`GET /api/ceasefire` remains public for the kingdoms page; manual PATCH imports
require `CRON_SECRET`. No browser Realtime Database credentials are needed for tracking.

To test local Realtime Database authentication and read access, run:

```bash
npm run test:firebase
```

The script loads `.env.local` / `.env` using Next.js development environment
precedence, reads at most one kingdom, and never writes data or prints credentials.
An empty path passes. Failures exit with code 1; network attempts time out
after 30 seconds. This checks read access, not write permissions.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
