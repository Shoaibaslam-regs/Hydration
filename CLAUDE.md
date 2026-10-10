# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Aqua is a responsive **website** (never a React Native/Expo app) where customers find nearby water shops and order water. It has a public site plus three dashboards: customer (`/account`), shopkeeper (`/shop`) and admin (`/admin`). The stack is Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, MongoDB through Mongoose 9, and zod 4.

Still open:
- **No payment gateway yet.** Customer orders are cash on delivery. Shop plans are billed manually (see "Billing" below). If a gateway is added, plug it in behind the same `SubscriptionPayment` records, and keep subscription billing and customer order payments in separate code, collections and secrets.
- **Unconfirmed assumptions.** `CURRENCY = "PKR"` and `TIME_ZONE = "Asia/Karachi"` (`lib/catalog.ts`), and the map's default center (`lib/geo.ts`) are placeholders the owner hasn't confirmed. The plan model (3-day free trial, then PKR 1,500/month, `lib/plans.ts`) was set by the owner.

## Commands

npm only (`package-lock.json`); don't switch to pnpm.

- `npm run dev`: start the dev server · `npm run build`: production build · `npm run lint` · `npm run typecheck`
- Phones on the same network can open `http://<LAN-IP>:3000` (the address is in `allowedDevOrigins`), but browsers block "My location" on plain HTTP. To test GPS, use an HTTPS tunnel (`npx cloudflared tunnel --url http://localhost:3000`) or `npm run dev:https` (self-signed; certificates go in the git-ignored `/certificates`).
- `npm test`: Vitest. Run one file with `npx vitest run lib/orders/cart.test.ts`, one test with `-t "name"`, or `npm run test:watch`.
- Only one `next dev` can run per checkout; a second one exits ("Another next dev server is already running"). To try a change while the owner's dev server is up, `npm run build`, then `MONGODB_URI=<scratch db> ./node_modules/.bin/next start -p 3100`.
- If typecheck complains about `.next/types` (stale after adding or removing a route), run `npx next typegen`.
- `npm run db:indexes`: sync indexes for every model in `lib/db/models/index.ts`. `autoIndex` is off, so **new indexes (including 2dsphere) don't exist until you run this.**
- `npm run db:seed -- --lat <lat> --lng <lng>`: dev-only demo shops (priced, on a trial or paid plan). It replaces previous `demo-*` shops.
- `npm run db:migrate`: one-off move to the can-ordering and trial model (see "Billing"). Safe to re-run.
- `npm run user:create-admin -- --email <e> --name "<n>"`: the only way to create an admin (it prints a generated password). Sign-up allows only `customer` and `shopkeeper`.
- `npm run shop:set-status -- --slug <s> --status <…> [--reason "…"]`: CLI fallback. Prefer `/admin/shops`, which clears the cache and writes to the audit log.

**Database connection.** `connectDB()` (`lib/db/connect.ts`) wraps `connectWithUri()` in `lib/db/connect-core.ts`, the one shared connection (on `globalThis`). It forces IPv4, keeps a warm pool (`minPoolSize: 2`) and retries fast DNS failures. `instrumentation.ts` calls `warmUp()` at server start, so the first visitor doesn't pay for DNS + TLS. `connect-core` has no `server-only` marker because instrumentation runs outside the RSC bundle. The owner's network times out on the DNS TXT lookup that `mongodb+srv://` needs (that caused ~25 s first loads), so their `.env` uses the standard `mongodb://host1,host2,host3/…?replicaSet=…&tls=true&authSource=admin` form of the Atlas address. Keep it that way on that network.

Scripts run through `tsx --env-file=.env`; the ones that import services also pass `--conditions=react-server` so `server-only` resolves. Variables already set in the shell win over `.env`, so `MONGODB_URI=mongodb://127.0.0.1:27017/scratch npm run db:seed …` targets a throwaway database instead of the real one. Required env vars are in `.env.example` (`MONGODB_URI`, `JWT_SECRET`); `GEOCODER_URL` and `GEOCODER_CONTACT_EMAIL` are optional (map search). Read them through `env()` (`lib/env.ts`). The one exception is `lib/auth/jwt.ts`, which reads `process.env` directly because `proxy.ts` imports it.

Tests: `*.test.ts` are unit tests; `*.int.test.ts` are integration tests against a real in-memory MongoDB (`mongodb-memory-server`, started once in `test/global-setup.ts`; each test file gets its own database). The first run on a new machine downloads a MongoDB binary (~100 MB) into `~/.cache/mongodb-binaries`. Integration test files call `setupTestDb()` (`test/db.ts`), which syncs indexes and clears the collections before each test, and build data with `test/fixtures.ts`. `test/setup.ts` mocks `next/cache` (its APIs only work inside Next), and Vitest replaces `server-only` with a stub. Test service changes there, especially anything involving prices, status changes or ownership.

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
- **There is no product catalog.** Customers order a number of 19L cans (`CAN_LABEL`, `MAX_CANS_PER_ORDER` in `lib/catalog.ts`) at the shop's single `Shop.pricePerCan` (minor units, set in the shop profile).
- Public listing requires `status: "verified"`, `closure: null` (open), `pricePerCan > 0` and a running trial or paid plan (`subscription.endsAt > now`). `buildSearchMatch` and `listableShopFilter()` (`lib/services/listing.ts`) hold the same rules; keep them in sync. The shopkeeper overview banner (`ShopStatusBanner`) says why an approved shop is hidden (no price, or plan ended).
- **Two different "verified" ideas.** `status: "verified"` means the shop is *approved* to be listed; the UI calls it "Approved"/"Approve". `Shop.verifiedBadge` (`{ grantedAt, grantedBy }`, null when absent) is a separate public ✓ **Verified** trust badge that admins give or remove (`grantVerifiedBadge` / `revokeVerifiedBadge`; removing it needs a reason). It shows through `hasVerifiedBadge` on every shop DTO and `components/shops/verified-badge.tsx`. Keep user-facing text consistent: "verified" only for the badge.
- **Closing is separate from approval.** `Shop.closure` (`{ by, at, reason }`, null when open) hides the shop from search and makes `placeOrder` refuse new orders, but existing orders can still be handled and the shop's page stays reachable with a "closed" notice. Shopkeepers close and reopen their own shop (`closeMyShop`/`reopenMyShop`). An admin close (`adminCloseShop`) can only be undone by an admin. The public page shows the shopkeeper's own note, never an admin's reason. Permanent deletion (`adminRemoveShop`, or the owner's `deleteMyShop` after typing the shop name) goes through `removeShopData` (`lib/services/shop-removal.ts`), which runs these steps in order: close the shop (so no new orders slip in), cancel its unfinished orders, delete its reviews and favorites, then delete the shop. Past orders stay.
- Search (`lib/services/shop-search.ts`, a pure function) is `$geoNear` → `$sort` → `$facet`, with every filter (max price per can, rating, deals) inside `$geoNear`.
- **Typed text is a place, not a filter.** `searchShops` with `q` and no `lat`/`lng` resolves the text to a point with `resolveSearchPlace` (`lib/services/search-place.ts`) and lists every listable shop around it, nearest first. The resolver tries, in order:
  1. The approved shop whose `Shop.searchText` (name and address, normalized by `shopSearchText()` in `lib/search/text.ts`; set on every shop save) contains at least half of the query words, in any order, ignoring case and hyphens.
  2. The map geocoder.
  3. The best partial match.

  If nothing is within the radius, it widens once to `MAX_RADIUS_KM`. The result carries `place`, `placeNotFound`, `widenedToKm` and `searched` (the input actually run, used for sponsored slots). With `lat`/`lng`, `q` still filters by name/area/city.
- `getShopBySlug` is the cached (`use cache`) public shop page. Anything that changes a shop, its deals or its reviews must invalidate `shopTag(slug)`. It returns `planEndsAt`; pages compare it with the current time after `connection()`, since a cached page can't.

**Orders** (`lib/orders/status.ts` holds the status rules for shopkeepers, customers and admins).
- `placeOrder` takes `{ shopSlug, quantity, addressId, … }`, prices the cans from `Shop.pricePerCan`, refuses shops that aren't listable, and checks the address is within the shop's delivery radius (`distanceKm`). There's no stock.
- Every status change uses the current status as a precondition (`findOneAndUpdate({ …, status: from })`) and returns 409 if another change got there first.
- Order lines are a snapshot (`name`, `type`, `sizeLiters`, `unitPrice`, `quantity`), so price changes never alter past orders and reports group by them. Orders from before the catalog was removed can have several lines with a `productId`; keep reading code tolerant of that.
- The order travels in the checkout URL (`?shop=…&cans=N`, parsed leniently by `parseCans`), so it survives the login redirect.
- A shopkeeper or admin status change sets `Order.customerUnread`; `getCustomerOrder` clears it when the customer opens the order.

**Admin** (`lib/services/admin/*`). Every change calls `logAdminAction()`, which is shown as "Admin history".
- **Suspension** can be timed (`days`: 1/3/7/14/30/90) or open-ended (`days: null`). Always check with `isSuspended(user, now)` / `suspendedFilter(now)` from `lib/auth/suspension.ts`, never `status === "suspended"` alone: an expired timed suspension counts as active with no background job, and the record is tidied on the user's next login.
- **Deleting an account** (`deleteUserAccount`, `lib/services/admin/user-removal.ts`) requires typing the user's email. It removes a shopkeeper's shop via `removeShopData`, cancels the customer's unfinished orders, and keeps past orders with the name, phone and street address replaced by placeholders. It deletes reviews (shop ratings are recalculated), addresses, reset links and the user. The audit entry stores the name and email because the account is gone. Plan payment records are kept.
- Rejecting or suspending a shop requires a reason, which the shopkeeper sees. Admins can't change their own account from the panel. Password reset has no email provider yet: an admin creates a one-time link (`lib/services/password-reset.ts`). Only a SHA-256 hash of the token is stored, the link expires after an hour, it is claimed atomically so it works once, and using it increments `sessionVersion`.

**Billing (shop plans, manual).** Every shop gets a `TRIAL_DAYS` (3) free trial when an admin first approves it (`startTrial()` in `lib/services/billing.ts`, called by `setShopStatus`; `Shop.trialStartedAt` makes it once-only). The trial is `Shop.subscription = { planId: "trial", endsAt }`. After it ends the shop is hidden and can't take orders until a monthly payment is approved. There's one paid plan (`PLANS`, "monthly", PKR 1,500). `planName()` also labels the trial and retired plan ids found on old payments.
- Shopkeepers pay outside the site and submit a reference at `/shop/billing`. That creates a `SubscriptionPayment` whose amount is always `plan.monthlyPrice × months`, computed on the server. A partial unique index allows only one `pending` payment per shop.
- Admins review payments at `/admin/subscriptions`. `approveSubscriptionPayment` claims the payment atomically and sets `Shop.subscription = { planId, endsAt }`. Renewals stack: a new period starts when the current one ends, using `nextPeriodStart` and `addMonths` from `lib/billing/constants.ts`.
- Paying during the trial adds the months after the trial ends (same stacking).
- `PlatformSettings` (read with `getPlatformSettings()`, cached under the `platform-settings` tag) holds only the payment and sponsorship texts. Admin settings changes are audited with `targetType: "platform"`.
- `npm run db:migrate` (`scripts/migrate-cans.ts`) moved existing data to this model: trials for approved shops, `pricePerCan` from each shop's old 19L can product, removal of the old catalog fields, and rebuilding every shop's `searchText`. It's safe to re-run.

**Notifications** (`lib/services/notifications.ts` → `GET /api/notifications`). Counts are keyed by the dashboard link they belong to: admin (pending shops, plan payments, sponsorship requests), shopkeeper (pending orders), customer (orders with `customerUnread`). `useNotificationCounts()` polls every 30 s, on navigation and on focus. `DashboardNavLinks` shows a `CountBadge` per link, and the public header shows a dot on the dashboard link. To add a notification, return a count under the right nav href.

**Advertising** (`lib/services/ads/*`, constants in `lib/ads/constants.ts`, models in `lib/db/models/ads.ts`). Shopkeepers use `/shop/promote`; admins use `/admin/ads`. Day boundaries use `TIME_ZONE` (`lib/ads/dates.ts`).
- **Sponsored placement:** up to `SPONSORED_SLOTS` shops, chosen with `$sample`, above page 1 of a *located* search (`findSponsoredShops` → `buildSponsoredPipeline`). They must pass the same filters as the organic results and be within their own delivery radius of the customer. A shop is eligible only with a running approved `SponsoredCampaign` (and it must still be listable). Campaigns are paid manually: the shop requests 1/2/4 weeks, the admin approves, rejects or cancels (each change uses the status as a precondition and is audited). Prices and payment text come from `PlatformSettings.sponsorshipInfo`.
- **Deals:** free, at most `MAX_RUNNING_DEALS` running per shop, 1–`MAX_DEAL_DAYS` days. `refreshShopDeal()` copies the longest-running deal onto `Shop.featuredDeal` (card tag and the `deals=1` search filter) and invalidates `shopTag` and `ads-deals`; call it after any deal change. Admins can remove a deal with a reason.
- **Home banners:** admin-managed, labelled "Promoted", cached under `ads-banners`. Links must be a same-site path or `https://` (`bannerLinkSchema`). Images are stored in MongoDB (`BannerImage`, served by `/api/banner-images/[id]` with an immutable cache, so a replaced image gets a new id). The type is checked from the bytes (`sniffImageType`: PNG/JPEG/WebP, max 2 MB, never SVG). Lean reads return BSON `Binary`, not `Buffer`.
- **Stats:** `AdStat` holds daily counters per `(kind, refId, day)`. Impressions come from the browser (`components/ads/ad-impression.tsx` → `POST /api/ads/event`, once per session), and clicks go through `GET /api/ads/click?kind&id`, which redirects to a target looked up in the database (no open redirect). The counts are approximate. Ad links are plain `<a>` tags, not `<Link>`, so prefetching doesn't count as a click.

**Reports.**
- `getSalesAnalytics(days, shopId?)` (`lib/services/analytics.ts`) powers both `/shop/reports` and `/admin/revenue`. Days are grouped in `TIME_ZONE`. "Delivered order value" is money paid to shops. Platform revenue is approved plan payments (`getRevenueAnalytics().totals.subscriptionRevenue`).
- CSV exports (`lib/services/reports.ts`) are capped at `EXPORT_ROW_LIMIT` rows and escape cells through `lib/reports/csv.ts`, which neutralizes spreadsheet formulas.

**UI.**
- Route groups: `(public)` has the site header and footer; `(customer)`, `(shop)` and `(admin)` share `DashboardShell`.
- Button colors come from variants (`danger` / `danger-outline` / `danger-ghost` for destructive actions, `on-dark` over dark photos). Don't recolor a variant with `className="text-…"`: the variant's own text color wins in the CSS, so add a variant instead.
- Site images live in `public/images` and are imported statically into `next/image` (which gives width, height and a blur placeholder automatically). Above-the-fold images use `preload`; `priority` is deprecated in Next 16. The home hero photo is dark in both themes, so its text uses fixed white rather than theme tokens.
- **Never use the browser's `confirm()`/`alert()`/`prompt()`.** Use `const confirm = useConfirm()` (`components/ui/confirm-dialog.tsx`, provider mounted in `app/layout.tsx`): `await confirm({ title, message, confirmLabel, tone: "danger" })`. `AdminActions` takes a `confirm` string per action. `color-scheme` on `:root` makes native selects and date pickers follow the theme.
- Shared primitives live in `components/ui`. Use the theme tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-chart-1`…), never raw Tailwind colors, so dark mode works.
- Location input is `components/map/location-picker.tsx` (place search, "My location", draggable pin), used for addresses and shop registration. It's built from `PlaceSearch` (`components/map/place-search.tsx`, a list of map matches to pick from) and `getDeviceLocation()` (`components/map/device-location.ts`), which tries GPS then network location and throws `DeviceLocationError` with a message ready to show. `/shops` (`ShopFilters`) has no map. It uses one `q` box, resolved on the server (see "Typed text is a place"), plus `getDeviceLocation()` for "Use my location", which sets `lat`/`lng` and drops `q`. `PlaceSearch` calls `/api/geocode`, which is public and goes through our server to Nominatim (`lib/services/geocode.ts`: identifying User-Agent, a day of `use cache`, a per-user or per-IP limit plus a site-wide 60/min limit). Never call the geocoder from the browser. "My location" needs a secure context (HTTPS or localhost), so on plain-HTTP LAN dev it explains this and points to search. `next.config.ts` allows LAN IPs and HTTPS tunnel hosts in `allowedDevOrigins` for phone testing.
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
- **zod 4:** `.partial()` keeps `.default()` values, so PATCH schemas must be built from fields without defaults (define the fields once, then add `.default()` only in the create schema), or a partial update will silently reset other fields.
- **Search params are user-controlled.** Pages `safeParse` them and fall back to defaults instead of throwing.
