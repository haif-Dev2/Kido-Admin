# Kido Admin Console

Web dashboard for the Kido babysitting marketplace. Lets administrators
moderate verifications, reports, users, bookings, and reviews.

This is one of three Kido apps:

| App | Stack | Users |
|---|---|---|
| `kido-app` | Expo / React Native | Parents, Babysitters |
| **`kido-admin` (this)** | Vite + React | Administrators |
| `Supabase` | Postgres | Shared backend |

## Stack

- **Build**: Vite + React 19
- **Language**: JSX + TypeScript at the boundaries
- **Data**: Supabase JS client; falls back to mock data when tables are empty
- **Auth**: Supabase Auth — only `profiles.role = 'admin'` may sign in
- **Charts**: Recharts
- **Hosting**: Vercel

## Getting started

```bash
# 1. Install
npm install

# 2. Set environment variables
cp .env.example .env
# Then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Run the database migration (first time only)
# In the Supabase SQL editor, paste and run `supabase-migration.sql`.

# 4. Promote a user to admin
#   UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';

# 5. Start the dev server
npm run dev
# Opens at http://localhost:5173
```

In development you can click **"Preview as demo admin"** on the login screen
to skip auth. This button is tree-shaken out of production builds via
`import.meta.env.DEV`.

## Project layout

```
src/
├── main.tsx           # Bootstraps React + <ErrorBoundary>
├── Root.jsx           # Auth gate: shows <Login> or <App>
├── Login.jsx          # Admin sign-in form
├── App.jsx            # Shell: sidebar + topbar + page router
├── ErrorBoundary.jsx  # Catches render errors anywhere below
├── supabase.ts        # Supabase client + getCurrentAdmin()
├── hooks.js           # useUsers, useBookings, useReports, ...
├── data.jsx           # Mock fallback data
├── components.jsx     # Card, Btn, Pill, Avatar, Sidebar, Topbar, ...
├── icons.jsx          # Lucide-style inline SVG icons
├── tweaks-panel.jsx   # Right-rail preference panel
└── pages/
    ├── Overview.jsx       # KPIs + bookings chart + open reports
    ├── Verifications.jsx  # Sitter verification queue
    ├── Reports.jsx        # User-submitted complaints
    ├── Users.jsx          # Parents + babysitters CRUD
    ├── Bookings.jsx       # Booking oversight
    ├── Reviews.jsx        # Flagged reviews moderation
    └── AuditLog.jsx       # Append-only admin action log
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server, port 5173, HMR enabled |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

## How the data layer works

Each page calls a hook from `src/hooks.js`:

```jsx
const { data: USERS, loading, error } = useUsers();
```

The hook queries Supabase. If the query fails OR returns zero rows, the hook
returns the corresponding mock array from `data.jsx`. This keeps the UI alive
during development before tables are populated, and during transient outages.

## Security model

- Supabase **Row Level Security** is enabled on `reports`, `verifications`,
  and `audit_log` (see `supabase-migration.sql`).
- Only rows where `public.is_admin() = true` are visible.
- The anon key in the browser is safe to expose; RLS is the enforcement layer.
- Sign-in is enforced client-side (`Root.jsx`) and server-side (via RLS).

## Deployment

Push to GitHub → connect to Vercel → set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in the Vercel project's Environment Variables →
done.

## License

Private — for the Kido thesis (mémoire 2025–2026).
