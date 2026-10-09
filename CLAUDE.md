# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Aqua is a responsive **website** (never a React Native/Expo app) where customers find nearby water shops and order water. It has a public site plus three dashboards: customer (`/account`), shopkeeper (`/shop`) and admin (`/admin`). The stack is Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, MongoDB through Mongoose 9, and zod 4.

Still open:
- **No payment provider yet.** Orders are cash on delivery, and shop subscriptions only exist as a "not available" page. When payments are added, subscription billing and customer order payments must use separate code, collections and secrets.
- **Unconfirmed assumptions.** `CURRENCY = "PKR"` and `TIME_ZONE = "Asia/Karachi"` (`lib/catalog.ts`), the map's default center (`lib/geo.ts`) and the plan prices (`lib/plans.ts`) are placeholders the owner hasn't confirmed.

## Commands

npm only (`package-lock.json`); don't switch to pnpm.

- `npm run dev`: start the dev server · `npm run build`: production build · `npm run lint` · `npm run typecheck`
- `npm test`: Vitest. Run one file with `npx vitest run lib/orders/cart.test.ts`, one test with `-t "name"`, or `npm run test:watch`.
- If typecheck complains about `.next/types` (stale after adding or removing a route), run `npx next typegen`.
- `npm run db:indexes`: sync indexes for every model in `lib/db/models/index.ts`. `autoIndex` is off, so **new indexes (including 2dsphere) don't exist until you run this.**
- `npm run db:seed -- --lat <lat> --lng <lng>`: dev-only demo shops. It replaces previous `demo-*` shops.
- `npm run user:create-admin -- --email <e> --name "<n>"`: the only way to create an admin (it prints a generated password). Sign-up allows only `customer` and `shopkeeper`.
- `npm run shop:set-status -- --slug <s> --status <…> [--reason "…"]`: CLI fallback. Prefer `/admin/shops`, which clears the cache and writes to the audit log.

Scripts run through `tsx --conditions=react-server`, so they can import `server-only` modules. Required env vars are in `.env.example` (`MONGODB_URI`, `JWT_SECRET`). Read them through `env()` (`lib/env.ts`). The one exception is `lib/auth/jwt.ts`, which reads `process.env` directly because `proxy.ts` imports it.

Tests: `*.test.ts` are unit tests; `*.int.test.ts` are integration tests against a real in-memory MongoDB (`mongodb-memory-server`, started once in `test/global-setup.ts`; each test file gets its own database). Integration test files call `setupTestDb()` (`test/db.ts`), which syncs indexes and clears the collections before each test, and build data with `test/fixtures.ts`. `test/setup.ts` mocks `next/cache` (its APIs only work inside Next), and Vitest replaces `server-only` with a stub. Test service changes there, especially anything involving stock, status changes or ownership.

## Architecture

**Request flow.**
- **Reads:** Server Components call `lib/services/*` directly, never their own API.
- **Writes:** every mutation goes Client Component → `apiRequest()` (`lib/api/client.ts`) → Route Handler → service. The client then calls `router.refresh()`. There are no Server Actions.
- **Route Handlers** (`app/api/**/route.ts`) stay thin. Each is wrapped in `apiHandler()` and does: auth → `parseBody`/`parseQuery` with a zod schema (`lib/validation/*`) → service → `json()`.
- **Services** throw `ApiError.*` for expected failures. Every error reaches the client as `{ error: { code, message, details? } }`, where `details.fieldErrors` is keyed by full path (`"address.city"`) so forms can show errors under the right field.
- `apiHandler` also calls `unstable_rethrow`, and rejects POST/PUT/PATCH/DELETE requests whose `Origin` doesn't match the host (CSRF defense).
- `parseBody` refuses JSON bodies over `MAX_BODY_BYTES` (64 KB) with a 413.
- `await rateLimit(key, limit, windowMs)` (`lib/api/rate-limit.ts`) is a fixed-window counter in MongoDB, shared across instances and keyed by a hash of the key. `clientIp()` trusts `X-Forwarded-For`, which clients can fake, so security-critical limits also need a key that doesn't include the IP (login has a per-account limit for this reason).

**Server/client boundary.** Any module that touches the database, secrets or the session starts with `import "server-only"`. Constants and pure logic safe for client code live outside `lib/services` (`lib/catalog.ts`, `lib/orders/*`, `lib/auth/roles.ts`, `lib/admin/shop-status.ts`, `lib/geo.ts`). Services return plain DTOs (string IDs, ISO dates, money as integer minor units, formatted with `formatPrice()`) and never Mongoose documents.

**Auth and authorization** (`lib/auth/`).
- **Sessions:** an HS256 JWT in the httpOnly `aqua_session` cookie. `getSessionUser()` re-loads the user from the database on every request and rejects anyone suspended or whose `sessionVersion` no longer matches. Increment `sessionVersion` to sign a user out everywhere (password change and suspension already do this).
- **Pages** call `requireRole([...], path)` inside `<Suspense>`, or `requireShopkeeperShop(path)` for shop pages. **Route Handlers** call `requireApiUser(roles)`. **Layouts never guard** (they don't re-run on navigation).
- **`proxy.ts`** only does quick redirects based on the cookie.
- **Ownership is always derived from the session, never from a request parameter.** For example, `requireMyShop(user.id)` then a query on `{ _id, shopId }`, or `{ _id, customerId }` for customer data. Copy this pattern for any new owner-scoped data.

**Shops and discovery.**
- Public listing requires `status: "verified"`, `closure: null` (open) and at least one active product.
- **Closing is separate from verification.** `Shop.closure` (`{ by, at, reason }`, null when open) hides the shop from search and makes `placeOrder` refuse new orders, but existing orders can still be handled and the shop's page stays reachable with a "closed" notice. Shopkeepers close and reopen their own shop (`closeMyShop`/`reopenMyShop`). An admin close (`adminCloseShop`) can only be undone by an admin. The public page shows the shopkeeper's own note, never an admin's reason. Permanent deletion (`adminRemoveShop`, or the owner's `deleteMyShop` after typing the shop name) goes through `removeShopData` (`lib/services/shop-removal.ts`), which runs these steps in order: close the shop (so no new orders slip in), cancel its unfinished orders, delete its products, reviews and favorites, then delete the shop. Past orders stay.
- Search (`lib/services/shop-search.ts`, a pure function) is `$geoNear` → `$sort` → `$facet`. Filters run inside `$geoNear` against fields copied onto the shop (`productTypes`, `minPrice`), so after any product change call `refreshShopCatalogSummary()` and `revalidateTag(shopTag(slug), { expire: 0 })`. The services already do both.
- `getShopBySlug` is the cached (`use cache`) public shop page. Anything that changes a shop, its products, its stock or its reviews must invalidate `shopTag(slug)`.

**Orders and stock** (`lib/orders/status.ts` holds the status rules for shopkeepers, customers and admins).
- `placeOrder` recomputes every price from the database, checks the address is within the shop's delivery radius (`distanceKm`), and reserves stock one item at a time with a conditional `$inc` (`stock: { $gte: qty }`). If a later item fails, the items already reserved are put back. No transactions are used, so this works on standalone Mongo too.
- Every status change uses the current status as a precondition (`findOneAndUpdate({ …, status: from })`) and returns 409 if another change got there first.
- Rejecting or cancelling (by the shopkeeper, the customer or an admin) returns stock through `returnStock()` (`lib/services/stock.ts`).
- Order lines store a copy of the product's details, so editing or deleting a product never changes past orders, and reports group by those copies.
- The cart travels in the checkout URL (`lib/orders/cart.ts`), so it survives the login redirect.

**Admin** (`lib/services/admin/*`). Every change calls `logAdminAction()`, which is shown as "Admin history". Rejecting or suspending a shop requires a reason, which the shopkeeper sees. Admins can't change their own account from the panel. Password reset has no email provider yet: an admin creates a one-time link (`lib/services/password-reset.ts`). Only a SHA-256 hash of the token is stored, the link expires after an hour, it is claimed atomically so it works once, and using it increments `sessionVersion`.

**Reports.**
- `getSalesAnalytics(days, shopId?)` (`lib/services/analytics.ts`) powers both `/shop/reports` and `/admin/revenue`. Days are grouped in `TIME_ZONE`. "Delivered order value" is money paid to shops, not platform revenue.
- CSV exports (`lib/services/reports.ts`) are capped at `EXPORT_ROW_LIMIT` rows and escape cells through `lib/reports/csv.ts`, which neutralizes spreadsheet formulas.

**UI.**
- Route groups: `(public)` has the site header and footer; `(customer)`, `(shop)` and `(admin)` share `DashboardShell`.
- Destructive buttons use the `danger` / `danger-outline` / `danger-ghost` `Button` variants. Don't add `className="text-danger"` to another variant: the variant's own text color wins in the CSS.
- Shared primitives live in `components/ui`. Use the theme tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-chart-1`…), never raw Tailwind colors, so dark mode works.
- Location input is `components/map/location-picker.tsx`: a place search, "My location", and a draggable pin. Search calls `/api/geocode`, which goes through our server to Nominatim (`lib/services/geocode.ts`: identifying User-Agent, per-user rate limit, a day of `use cache`). Never call the geocoder from the browser. "My location" needs a secure context (HTTPS or localhost), so on plain-HTTP LAN dev it explains this and points to search. `next.config.ts` allows LAN IPs and HTTPS tunnel hosts in `allowedDevOrigins` for phone testing.
- Only `components/map/location-map.tsx` knows the map provider (Leaflet + OpenStreetMap tiles, imported in `useEffect`). Use a commercial tile provider in production.
- Charts follow the dataviz skill: one hue (`--chart-1`), a hover/focus tooltip on every mark, and a "Show as table" view.

## Next.js 16 rules this code depends on

- **`cacheComponents: true`.** Data is fetched fresh on every request by default, and anything that reads cookies, `params`, `searchParams` or the database must render inside `<Suspense>`. `cookies()` can't be called inside `use cache`, and old route settings (`dynamic`, `revalidate`, `runtime`) don't work.
- **Call `await connection()` before uncached database queries** that run after reading the URL, and in Route Handlers that query the database without touching the request. Otherwise Next prerenders them and the driver's `new Date()` throws. `getSessionUser()` already does this.
- **Client hooks that read the URL** (`usePathname`, `useSearchParams`) must sit under `<Suspense>`, or the build fails on dynamic routes.
- **`partialPrefetching: true`** is on.
- **`proxy.ts` replaces `middleware.ts`.**
- **Security headers** (CSP, HSTS, frame and permissions policies) are set in `next.config.ts` `headers()`. The CSP doesn't use nonces, because nonces force every page to render dynamically and conflict with Partial Prerendering. Add any new third-party origin (map tiles, payment SDK) to the CSP there.
- **`error.tsx` receives `retry`** (not `reset`).
- **`revalidateTag` takes a second argument.** We use `{ expire: 0 }` so changes show immediately.
- **`experimental.agentFeedback`** makes `next dev` rewrite the managed block in `AGENTS.md`. Leave it alone.
- **Tailwind v4 runs through the `@tailwindcss/turbopack` loader**, with no Tailwind or PostCSS config file. Theme tokens are defined in `app/globals.css` (`:root` + `@theme inline`, with a dark override).

## Conventions

- Pages and layouts use the generated route types (`PageProps<"/x/[id]">`, `LayoutProps<"/">`), and Route Handlers use `RouteContext<"/api/…">`.
- **Mongoose models:** register every model in `lib/db/models/index.ts`, export it as `(models.X as ReturnType<typeof createXModel> | undefined) ?? createXModel()` (casting to `Model<XDoc>` breaks query typing), and write middleware hooks as async functions. Store geo fields as GeoJSON `Point` with a `2dsphere` index.
- **zod 4:** `.partial()` keeps `.default()` values, so PATCH schemas must be built from fields without defaults (see `productUpdateSchema`), or a partial update will silently reset other fields.
- **Search params are user-controlled.** Pages `safeParse` them and fall back to defaults instead of throwing.
