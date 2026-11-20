# Surinder Caterers – Catering Management Portal

A full-stack catering management platform with two experiences:

- **Customer portal**: register, plan an event, browse the live dish catalogue, get AI menu suggestions, submit enquiries, and review and accept quotations.
- **Owner/Admin portal**: manage dishes, review enquiries, build and send branded PDF quotations, and track events.

> **Status:** Phase 1 (project foundation) is complete. Backend features are added phase by phase; see the roadmap below.

## Tech stack

| Area          | Choice                                              |
| ------------- | --------------------------------------------------- |
| Frontend      | React 19, Vite, JavaScript                          |
| Styling       | Tailwind CSS v4 (design tokens in `src/index.css`) |
| Routing       | React Router                                        |
| Icons / toast | Lucide React, Sonner                                |
| Backend       | Supabase (PostgreSQL, Auth, Storage, RLS)           |
| Server code   | Vercel serverless functions (`/api`) for AI calls   |
| Hosting       | Vercel                                              |

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:5173
```

| Script            | Purpose                    |
| ----------------- | -------------------------- |
| `npm run dev`     | Start the dev server       |
| `npm run build`   | Production build to `dist` |
| `npm run preview` | Serve the production build |
| `npm run lint`    | Run ESLint                 |

## Environment variables

See `.env.example`.

- `VITE_*` variables are bundled into the browser. Only **public** values belong there (the Supabase URL and publishable key).
- `SUPABASE_SECRET_KEY` and `AI_API_KEY` are **server-only**. They are used only inside `/api` functions and set in Vercel's environment settings. Never prefix them with `VITE_`. `src/lib/supabase.js` refuses to start if a secret key is configured for the browser.
- `.env` and `.env.local` are git-ignored.

## Database

The schema lives in `supabase/migrations/` and is applied in filename order:

| Migration           | Contents                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `…_core_schema.sql` | Tables, constraints, indexes, snapshot and total-calculation triggers    |
| `…_rls_policies.sql`| Row Level Security policies and table/column privileges                  |
| `…_storage.sql`     | `dish-images` bucket (public read, admin write)                          |

Key rules enforced **in the database** (not just the UI):

- Every new sign-up gets a `customer` profile. No API user, including an admin, can change `role`.
- Customers see only their own enquiries, quotations and notifications, and never draft quotations or internal admin notes.
- Dish names and prices in enquiries and quotations are **snapshots** taken from the `dishes` table. Client-supplied prices are ignored. Editing or deleting a dish never changes history.
- Quotation totals (subtotal, charges, discount, GST, total, advance, balance) are computed by the database. A version is locked once sent; changes require a new revision.
- Logged-out visitors have no table access.

### Authentication setup (Supabase dashboard)

- **Authentication → URL Configuration**: set **Site URL** to the app's address (`http://localhost:5173` in development, the Vercel URL in production) and add `<app-url>/**` to **Redirect URLs**. Confirmation and password-reset links only work for listed URLs.
- **Email delivery**: Supabase's built-in email sender only delivers to members of your Supabase organisation and is heavily rate-limited. Configure custom SMTP (**Authentication → Emails → SMTP Settings**) before real customers sign up.
- Sessions use the PKCE flow, so confirmation and reset links must be opened in the same browser that requested them.

### Making someone an admin

Admins are promoted manually in the Supabase **SQL editor** (never through the app). The user must have signed up first:

```sql
update public.profiles set role = 'admin' where email = 'owner@example.com';
```

## Project structure

```
api/                  Vercel serverless functions (AI, privileged ops)    – Phase 6+
supabase/migrations/  SQL schema, RLS policies, storage policies
src/
  components/
    brand/            Logo and brand elements
    ui/               Reusable design-system components (Button, …)
  layouts/            Public, customer and admin layouts
  pages/
    public/           Marketing / landing pages
    auth/             Login, register, password reset                     – Phase 3
    customer/         Customer portal pages                               – Phase 3+
    admin/            Admin portal pages                                  – Phase 3+
  lib/                Supabase client and configuration
  services/           Database service functions (one file per domain)    – Phase 4+
  ai/                 Client-side calls to the /api AI endpoints          – Phase 6
  pdf/                Quotation PDF generation                            – Phase 8
  utils/              Small shared helpers
```

Import from `src` with the `@/` alias, for example `import Button from '@/components/ui/Button.jsx'`.

## Design system

Colour tokens: `ivory` (backgrounds), `forest` (primary), `burgundy` (accent and destructive), `gold` (highlights), `ink` (text). Fonts: `font-display` (Cormorant Garamond) for headings and `font-sans` (Manrope) for body text. All tokens are defined in `src/index.css` under `@theme`.

## Roadmap

1. ✅ Project foundation: Vite, React, Tailwind, routing, design tokens, Git
2. ✅ Supabase connection, database schema, RLS policies
3. 🟡 Authentication, profiles, protected customer and admin layouts (built; awaiting live sign-up test)
4. Dish management (admin) and menu browsing (customer)
5. Enquiry submission and tracking
6. AI menu recommendations (server-side, database-only dishes)
7. Admin enquiry management and quotation builder
8. PDF quotations and notifications
9. Security, responsiveness and end-to-end testing

## Deployment (Vercel)

Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. `vercel.json` rewrites every non-`/api` route to `index.html` so client-side routes work on refresh.
