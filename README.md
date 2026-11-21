# Surinder Caterers – Catering Management Portal

A full-stack catering management platform with two experiences:

- **Customer portal**: register, plan an event, browse the live dish catalogue, get AI menu suggestions, submit enquiries, and review and accept quotations.
- **Owner/Admin portal**: manage dishes, review enquiries, build and send branded PDF quotations, and track events.

> **Status:** Phases 1–5 are complete: project foundation, the Supabase schema and RLS (applied to the live project), authentication with customer/admin portals, dish management with the customer menu, and customer enquiry submission and tracking (Phases 3–5 tested against live Supabase on 21 Nov 2026). Features are added phase by phase; see the roadmap below.

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
- `ANTHROPIC_API_KEY` (and `SUPABASE_SECRET_KEY`, reserved for later phases) are **server-only**. They are used only inside `/api` functions and set in Vercel's environment settings. Never prefix them with `VITE_`. In development, put them in `.env.local`: `npm run dev` serves `/api/*` from the `api/` folder and passes them only to those handlers. `src/lib/supabase.js` refuses to start if a secret key is configured for the browser.
- `.env` and `.env.local` are git-ignored.

## Database

The schema lives in `supabase/migrations/` and is applied in filename order:

| Migration           | Contents                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `…_core_schema.sql` | Tables, constraints, indexes, snapshot and total-calculation triggers    |
| `…_rls_policies.sql`| Row Level Security policies and table/column privileges                  |
| `…_storage.sql`     | `dish-images` bucket (public read, admin write)                          |
| `…_seed_catalogue.sql` | Starter categories and cuisines (no dishes). Safe to re-run          |
| `…_storage_admin_select.sql` | Lets admins list and delete dish photos (needed for photo cleanup) |
| `…_enquiry_rpcs.sql` | `submit_enquiry` / `cancel_enquiry`: the only way customers create or cancel enquiries |
| `…_ai_suggestions.sql` | `claim_ai_suggestion()` rate limit (3/minute, 20/day per user) and `submit_enquiry` recording `source = 'ai'` for accepted suggestions |
| `…_menu_catalogue.sql` | Nullable dish `price` ("price on request"), the menu's five descriptive columns, and dish names unique per category |
| `…_ai_suggestion_refunds.sql` | `refund_ai_suggestion()`: gives back one suggestion slot when the AI provider fails or times out. Server-only (needs `SUPABASE_SECRET_KEY`), at most once per claim |

### Importing the official menu

`Menu_Portal_Classification.xlsx` is the customer-facing menu (337 vegetarian + 242 non-vegetarian dishes). `scripts/menu-import/generate_menu_import.py` (Python 3.10+, standard library only) checks the workbook and writes two SQL files to `supabase/imports/`:

```sh
python -I scripts/menu-import/generate_menu_import.py Menu_Portal_Classification.xlsx
```

Run `menu_portal_classification.dry_run.sql` in the SQL editor first. It performs the whole import, returns a report table, and rolls back. Then run `menu_portal_classification.apply.sql`. Both files are safe to re-run: dishes are matched by category + name. Re-running refreshes the workbook columns only, never prices, photos, allergens, descriptions or availability set in the app. Categories and cuisines are matched by name ignoring case and spacing, so no duplicates are created. Imported dishes have no price until an admin sets one.

Key rules enforced **in the database** (not just the UI):

- Every new sign-up gets a `customer` profile. No API user, including an admin, can change `role`.
- Customers see only their own enquiries, quotations and notifications, and never draft quotations or internal admin notes.
- Dish names and prices in enquiries and quotations are **snapshots** taken from the `dishes` table. Client-supplied prices are ignored. Editing or deleting a dish never changes history.
- Quotation totals (subtotal, charges, discount, GST, total, advance, balance) are computed by the database. A version is locked once sent; changes require a new revision.
- Logged-out visitors have no table access.
- Customers cannot insert or update enquiry tables directly; `submit_enquiry()` / `cancel_enquiry()` always act as the signed-in user. Enquiries can't be deleted through the API, and an account that has enquiries can't be deleted from the dashboard (`on delete restrict`) so business records survive.

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
api/                  Vercel serverless functions (menu-suggestions.js)
supabase/migrations/  SQL schema, RLS policies, storage policies
src/
  components/
    brand/            Logo and brand elements
    ui/               Reusable design-system components (Button, …)
    catalogue/        Dish photo, veg/non-veg mark, image picker
    feedback/         Alerts, loaders, empty states, confirm dialog
  constants/          Labels that mirror database CHECK constraints
  hooks/              useForm, useAsync
  layouts/            Public, customer and admin layouts
  pages/
    public/           Marketing / landing pages
    auth/             Login, register, password reset                     – Phase 3
    customer/         Customer portal pages                               – Phase 3+
    admin/            Admin portal pages                                  – Phase 3+
  lib/                Supabase client and configuration
  services/           Database service functions (one file per domain)    – Phase 4+
  ai/                 Client-side calls to the /api AI endpoints
  pdf/                Quotation PDF generation                            – Phase 8
  utils/              Small shared helpers
```

Import from `src` with the `@/` alias, for example `import Button from '@/components/ui/Button.jsx'`.

## Design system

Colour tokens: `ivory` (backgrounds), `forest` (primary), `burgundy` (accent and destructive), `gold` (highlights), `ink` (text). Fonts: `font-display` (Cormorant Garamond) for headings and `font-sans` (Manrope) for body text. All tokens are defined in `src/index.css` under `@theme`.

## Roadmap

1. ✅ Project foundation: Vite, React, Tailwind, routing, design tokens, Git
2. ✅ Supabase connection, database schema, RLS policies
3. ✅ Authentication, profiles, protected customer and admin layouts. Verified live: sign-up and profile creation, login, logout, password change, route protection, customer blocked from admin, and the RLS checks (no self-promotion, own-profile-only). The email links themselves (confirmation and reset) depend on email delivery; re-test them once custom SMTP is configured.
4. ✅ Dish management (admin: dishes with photos, categories, cuisines) and menu browsing (customer: search, cuisine/diet/range filters). Verified live 21 Nov 2026, including RLS (customers read-only, hidden categories invisible) and photo upload/cleanup
5. ✅ Enquiry submission and tracking: a four-step enquiry form (event, optional dishes from the live menu, contact/budget, review) that autosaves a draft; enquiry list and detail pages with a status timeline; cancel while submitted or under review. Submission goes through a validated database function (prices snapshotted from `dishes`, max 10 enquiries per customer per day). Verified live 21 Nov 2026
6. 🚧 AI menu recommendations: a "Suggest a menu" panel on the enquiry Menu step. `api/menu-suggestions.js` checks the caller's Supabase session, loads the catalogue with the caller's own token (RLS applies), claims a rate-limit slot, and asks Claude (`claude-opus-5-5`, JSON-schema output) to choose dishes by reference from that catalogue only. Unknown references are dropped, so names and prices always come from the database. Customers add suggestions one at a time or all at once; accepted dishes are stored with `source = 'ai'`. If the AI provider fails, times out or returns unusable output, the customer's daily slot is refunded (server-only, at most once per claim). Verified 21 Nov 2026 with mocked AI responses against the live database (64 handler checks) and on PostgreSQL 17 (33 refund/concurrency checks). Pending: live AI integration test (suggestion quality, dietary rules, prompt injection) once API credits are available
7. Admin enquiry management and quotation builder
8. PDF quotations and notifications
9. Security, responsiveness and end-to-end testing

## Deployment (Vercel)

Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. `vercel.json` rewrites every non-`/api` route to `index.html` so client-side routes work on refresh.
