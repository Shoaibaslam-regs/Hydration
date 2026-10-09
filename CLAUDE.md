# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Aqua: a responsive **website** (not a React Native/Expo app) where customers find nearby water shops and order water. It has a public site plus separate customer, shopkeeper and admin dashboards. MongoDB stores the data (through Mongoose), and nearby search uses geospatial queries. Auth uses JWTs (`jose`) in httpOnly cookies, and passwords are hashed with `bcryptjs`. The payment provider hasn't been chosen yet. Subscription payments (shopkeepers) and customer order payments must always stay in separate code, collections and secrets.

## Commands

npm is the package manager (`package-lock.json`). Don't switch to pnpm.

- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: `tsc --noEmit`. Generated route types live in `.next/types`; if they're stale (e.g. after deleting a route), run `npx next typegen` or a build first.
- `npm test`: Vitest (`*.test.ts` next to the code). Run one file with `npx vitest run lib/api/handler.test.ts`, or one test with `-t "name"`.
- `npm run db:indexes`: sync indexes for every model registered in `lib/db/models/index.ts`. Mongoose `autoIndex` is off, so new indexes (including `2dsphere`) don't exist until this runs.
- `npm run db:seed -- --lat <lat> --lng <lng>`: dev-only demo shops/products around a point (replaces previous `demo-*` shops). Scripts run with `tsx --conditions=react-server` so modules that import `server-only` load outside Next.

- `npm run user:create-admin -- --email <email> --name "<name>"`: the only way to create an admin (it prints a generated password once). Sign-up allows only `customer` and `shopkeeper`.

- `npm run shop:set-status -- --slug <slug> --status <…> [--reason "..."]`: CLI fallback for shop verification. Prefer `/admin/shops`, which clears the cache and writes to the audit log. The CLI does neither, so the public page can take about a minute to update.

Env vars: see `.env.example` (`MONGODB_URI`, `JWT_SECRET`, both required). Server code reads them through `env()` in `lib/env.ts`, which validates them with zod. The one exception is `lib/auth/jwt.ts`, which reads `process.env.JWT_SECRET` directly because `proxy.ts` imports it and can't load `server-only` modules.

## Architecture

- `app/(public)/`: marketing and discovery pages that share the header/footer layout. Dashboards will go in their own route groups (`(customer)`, `(shop)`, `(admin)`).
- `app/api/**/route.ts`: Route Handlers, kept thin. Each one is wrapped in `apiHandler()` and does: parse input with `parseBody`/`parseQuery` and a zod schema → check auth → call a service → `json()`. Throw `ApiError.*` (`lib/api/errors.ts`) for expected failures. Every error comes back as `{ error: { code, message, details? } }`.
- `lib/`: server-side code. Every module that touches the database, secrets or auth starts with `import "server-only"`. Use `connectDB()` from `lib/db/connect.ts`, which keeps one cached connection. Business logic belongs in `lib/services/<domain>`, not in routes or components.
- `lib/validation/`: zod schemas shared by handlers and forms. List endpoints use `paginationSchema` + `paginated()` so pagination happens on the server.
- Discovery: `lib/services/shop-search.ts` builds the search aggregation as a pure, unit-tested function (`$geoNear` first when lat/lng are given, then `$sort`, then `$facet` for pagination). Shops store denormalized `productTypes`/`minPrice` so filters work inside `$geoNear`; call `refreshShopCatalogSummary()` (`lib/services/catalog.ts`) after any product change, and revalidate `shopTag(slug)` because `getShopBySlug` is cached with `use cache`. Only `status: "verified"` shops with at least one active product are public.
- Money is stored as integer minor units; format with `formatPrice()` and convert user input with `toMinorUnits()` (`lib/catalog.ts`, which also holds `CURRENCY` and other constants safe for client code). Plans live in `lib/plans.ts`.
- Auth (`lib/auth/`): sessions are HS256 JWTs (`jose`) in the httpOnly `aqua_session` cookie (7 days). `getSessionUser()` (`session.ts`) verifies the JWT, then loads the user from the database on every request and rejects suspended users or a mismatched `sessionVersion` (increase it to revoke all of a user's sessions). Pages call `requireRole([...], currentPath)` inside `<Suspense>`. Layouts don't re-run on navigation, so they never guard anything. Route Handlers call `requireApiUser(roles?)`. `proxy.ts` only does quick redirects for `/account`, `/shop` and `/admin` based on the cookie, with no database check. Role ↔ dashboard mapping and safe `?next=` handling live in `roles.ts`, which is safe for client code.
- Shopkeeper area: `lib/services/my-shop.ts`, `my-products.ts` and `shop-orders.ts` always take the shop from the signed-in owner (`requireMyShop(user.id)` in APIs, `requireShopkeeperShop(path)` in pages). Never accept a shop ID from the client, and always query products and orders with `{ _id, shopId }`. One shop per shopkeeper (unique `ownerId`), and its slug never changes after creation. After any product change, call `refreshShopCatalogSummary` and `revalidateTag(shopTag(slug), { expire: 0 })` (the services already do this).
- Customer ordering: the cart travels in the checkout URL (`/account/checkout?shop=<slug>&items=<id>:<qty>,…`, see `lib/orders/cart.ts`), so it survives the login redirect. `placeOrder` (`lib/services/customer-orders.ts`) ignores any prices sent by the client. It checks the address is inside the shop's delivery radius (`distanceKm` in `lib/geo.ts`) and reserves stock item by item with conditional `$inc` (`stock: { $gte: qty }`), giving back already-reserved items if a later one fails. No transactions are needed, so it works on standalone Mongo too. Customers can cancel only `pending` orders. Reviews require a delivered order, one per order, and recompute the shop's `rating`. Favorites are stored in `User.favoriteShopIds`. Changing the password increments `sessionVersion`, which signs out other devices.
- Maps: `components/map/location-map.tsx` is the only file that knows the map provider (Leaflet + OpenStreetMap tiles, no API key). Leaflet is imported inside `useEffect` because it needs `window`. `LocationPicker` adds "use my location" plus a draggable pin. The public OSM tile servers are only meant for light use, so use a commercial tile provider in production.
- Admin (`lib/services/admin/*`, `/admin/*`, `/api/admin/*`): every admin change calls `logAdminAction` (stored in the `AdminAction` collection and shown as "Admin history"). Shop status rules live in `lib/admin/shop-status.ts`, and rejecting or suspending needs a reason the shopkeeper can see. Admins can't change their own account from the panel. Suspending a user increments their `sessionVersion`. Admin order cancellation works on any order that isn't final and returns stock. Analytics live in `lib/services/analytics.ts`: `getSalesAnalytics(days, shopId?)` is shared by `/shop/reports` (scoped to one shop) and `/admin/revenue` (platform-wide, via `getRevenueAnalytics`). Days are grouped in `TIME_ZONE`, top products are grouped by the product details copied into each order line (so renamed or deleted products still show up), and "delivered order value" is money customers paid to shops, not platform revenue (subscription billing doesn't exist yet). `components/admin/admin-actions.tsx` is the shared "button + optional reason" mutation UI.
- CSV exports (`lib/services/reports.ts`, `lib/reports/csv.ts`) return at most `EXPORT_ROW_LIMIT` rows (the `X-Export-Truncated` header is set when the limit is hit). Cells starting with `= + - @` get a leading `'` to block spreadsheet formula injection, and the file starts with a UTF-8 BOM so Excel reads it correctly. Exports are GET Route Handlers, linked with `<a download>`.
- Charts follow the dataviz skill: one-hue series use the `--chart-1` token (validated separately for light and dark), every bar has a hover/focus tooltip, and every chart has a "Show as table" view.
- Orders: the status machine lives in `lib/orders/status.ts` (client-safe). Status updates use the current status as a precondition (`findOneAndUpdate({ status: from })`) so concurrent changes can't both apply. Rejecting or cancelling returns stock, and delivering a cash-on-delivery order marks it paid. Order lines store a copy of each product's details, and amounts are in minor units. Order payment is separate from subscription billing.
- Validation errors come back as `details.fieldErrors` keyed by full path (`"address.city"`). In zod 4, `.partial()` keeps `.default()`s, so PATCH schemas must be built from fields that have no defaults (see `productUpdateSchema`).
- `getSessionUser()` calls `connection()` before checking the token, so session reads and the queries that follow always run at request time.
- Route groups: `(public)` (site header/footer), `(customer)/account`, `(shop)/shop`, `(admin)/admin` (these three use `DashboardShell`). Client forms call the Route Handlers through `apiRequest()` (`lib/api/client.ts`), which returns field errors from zod.
- `apiHandler` rejects POST/PUT/PATCH/DELETE requests whose `Origin` doesn't match the host (CSRF defense). `rateLimit()` (`lib/api/rate-limit.ts`) keeps counts in memory, per process.
- `components/ui/`: shared UI building blocks (`Button`/`buttonClasses` for links, `Input`, `Field`, `Card`, `Badge`, `Container`). Use the theme color tokens (`bg-primary`, `text-muted-foreground`, `border-border`…) instead of raw Tailwind colors so dark mode keeps working.
- Vitest replaces `server-only` with a stub (`test/server-only-stub.ts`), so server modules can be unit-tested.

## Configuration that changes how code must be written

`next.config.ts` turns on features that affect rendering and data fetching:

- **`cacheComponents: true`**: data is fetched fresh on each request by default; opt into caching with `use cache` (plus `cacheLife` / `cacheTag`). Next prerenders a static shell, so reading dynamic data (cookies/session, the database) has to happen inside `<Suspense>`. A Route Handler that reads the database without reading the request should call `await connection()` first. `cookies()` can't be called inside `use cache`. Old route settings (`dynamic`, `revalidate`, `runtime = 'edge'`) don't apply here. See `02-guides/authentication-with-cache-components.md` and `02-guides/migrating-to-cache-components.md` in the bundled docs.
- Server components that run uncached DB queries after reading `searchParams`/`params` should `await connection()` first. Otherwise a prefetch prerender runs the query and fails on the driver's `new Date()`. Client hooks that read the URL (`usePathname`, `useSearchParams`) must sit under `<Suspense>`, or the build fails on dynamic routes.
- Any `try/catch` around Next APIs must call `unstable_rethrow(err)` first, or it will swallow Next's internal errors (prerender bailouts, `redirect`, `notFound`). `apiHandler` already does this.
- `middleware.ts` is deprecated in Next 16 and replaced by `proxy.ts`. Use it only for quick redirects. Real authorization checks belong in the server code that reads and writes data.
- **`partialPrefetching: true`**: `<Link>` prefetches only the static parts of a page by default.
- **`experimental.agentFeedback: true`**: `next dev` keeps rewriting the managed block in `AGENTS.md`; leave it as-is.
- **Tailwind v4** runs through the `@tailwindcss/turbopack` loader (no `tailwind.config`/PostCSS). Theme colors are defined in `app/globals.css` (`:root` variables + `@theme inline`, with a `prefers-color-scheme: dark` override).
- Mongoose 9: middleware hooks are async functions. Don't use the `next()` callback. Export models as `(models.X as ReturnType<typeof createXModel> | undefined) ?? createXModel()`. Casting to `Model<XDoc>` breaks query and `insertMany` typing.
- `error.tsx` boundaries receive `retry` (not `reset`).

## Conventions

- Layouts/pages use the route types Next generates (`LayoutProps<"/">`, `PageProps<...>`) instead of hand-written props types.
- Every new Mongoose model must be added to `lib/db/models/index.ts`, and geo fields are stored as GeoJSON `Point` with a `2dsphere` index.
