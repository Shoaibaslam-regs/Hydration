# Aqua

Aqua is a responsive website that connects customers with local water shops. Customers find the nearest shops, order 19-litre water cans for delivery (cash on delivery), and track their orders. Shopkeepers set one price per can, handle orders, and see sales reports and promotions. Admins approve shops, manage users, orders and ads, and see platform revenue.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, MongoDB (Mongoose) and zod.

## Getting started

Requirements: Node.js 24+, npm, and a MongoDB database (MongoDB Atlas or local, version 6+).

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run db:indexes        # creates indexes, including the geospatial index search needs
npm run user:create-admin -- --email you@example.com --name "Your Name"
npm run dev               # http://localhost:3000
```

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string. Put the database name in the path, e.g. `…mongodb.net/aqua?…` |
| `JWT_SECRET` | At least 32 characters. Generate one with `openssl rand -base64 32` |

Optional settings: `GEOCODER_URL` and `GEOCODER_CONTACT_EMAIL` configure the map search box (see `.env.example`).

### Slow first load or "querySrv/queryTxt" errors

Some routers and ISPs fail the DNS lookups that `mongodb+srv://` addresses need, which makes the first database connection hang for ~25 seconds or fail. Use the standard address instead: in Atlas choose **Connect → Drivers**, pick an old driver version (e.g. Node.js 2.2.12) to get a `mongodb://host1,host2,host3/...` string, add your database name, and put it in `MONGODB_URI`. The app also opens the connection at startup (`instrumentation.ts`) so visitors don't wait for it.

### Testing on a phone

Start the dev server and open `http://<your-computer's-LAN-IP>:3000` on a phone on the same Wi-Fi. Everything works except **"My location"**: browsers only share location on secure (`https://`) pages, so on plain HTTP the button explains this and points to the map search instead. To test GPS on a phone, use HTTPS:

- **Tunnel (most reliable):** run `npx cloudflared tunnel --url http://localhost:3000` (or ngrok) and open the `https://…trycloudflare.com` address it prints. These hosts are already allowed in `next.config.ts`.
- **`npm run dev:https`:** self-signed HTTPS on your LAN IP. The phone shows a certificate warning that you must accept, and some browsers may still refuse location after that.

On the real site (served over HTTPS) location works normally.

Optional demo data around a location:

```bash
npm run db:seed -- --lat 31.5204 --lng 74.3587
```

Demo shops are created as approved, except one left pending so the review queue has something in it. Shops that real shopkeepers register start as **pending** until an admin approves them at `/admin/shops`. Approval is separate from the public ✓ **Verified** badge, which admins give to trusted shops from the same page.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, and serve the production build |
| `npm run dev:https` | Dev server over self-signed HTTPS on your network, for testing "My location" on a phone |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Unit and integration tests. Integration tests start an in-memory MongoDB automatically. |
| `npm run db:indexes` | Sync database indexes. Run it after pulling changes that add models or indexes (the advertising features added five collections). |
| `npm run db:seed` | Demo shops (development only) |
| `npm run db:migrate` | One-off: move an existing database to ordering by the can with free trials (starts trials for approved shops, copies each shop's old 19L can price) and build each shop's search text. Safe to run again. |
| `npm run user:create-admin` | Create an admin account (prints a one-time password) |
| `npm run shop:set-status` | Change a shop's status from the command line (prefer the admin panel) |

## Accounts and roles

- **Finding shops** (`/shops`): customers type any part of their address, in any order (for example "orangi town gulshan e bahar" or just "gulshan bahar"), or tap "Use my location". Aqua finds that area from shop addresses (or the map if no shop matches) and lists the shops around it, nearest first. If none are within the chosen distance, it searches up to 50 km.
- **Customers** sign up at `/register`. A red dot on "My orders" shows when a shop has updated an order. They save delivery addresses, order, track, cancel (before the shop accepts) and review deliveries.
- **Shopkeepers** sign up at `/register` (or "Register your shop" on `/pricing`), then register their shop at `/shop/profile`. They set their price per 19L can there. The shop appears publicly once an admin approves it, which also starts a 3-day free trial; after that it stays listed while the PKR 1,500/month plan is paid. They can close it temporarily (Overview), delete it permanently (Shop profile), pay for a plan (`/shop/billing`), and post deals or request sponsorship (`/shop/promote`).
- **Admins** are created only with `npm run user:create-admin`. Their menu shows a red count for shops, plan payments and sponsorship requests waiting for review. They approve shops and give the Verified badge, suspend users (for 1–90 days or until lifted) or delete accounts, review plan payments, and manage ads. There's no password reset email yet: admins create one-time reset links from `/admin/users/<id>`.

## Advertising

Managed at `/admin/ads`; shopkeepers use `/shop/promote`.

- **Sponsored shops.** Up to two shops marked "Sponsored" appear above the first page of a location search. They're picked at random from shops that match the customer's filters and deliver to their location. Shops request a 1, 2 or 4 week campaign, pay you outside the site, and an admin approves it. Enter your prices and payment details under **Admin → Ads → Sponsored**: shopkeepers see that text when they request a campaign.
- **Deals.** Free for shops: up to three at a time, each running 1–30 days. They show on the shop's card (with a "Deal" tag), behind a "Deals only" search filter, on the shop's page, and in "Latest deals" on the home page. Admins can remove a misleading deal with a reason the shop sees.
- **Home banners.** Admin-made banners with an optional image (PNG, JPEG or WebP, up to 2 MB), a link and start/end dates. They rotate on the home page, marked "Promoted".
- **Stats.** Views and clicks for the last 30 days, shown to shops for sponsorship and to admins for banners. They're approximate: each browser session counts a view once, and bots aren't filtered out.

## Production notes

- **Payments.** Customer orders are cash on delivery. Shops get a 3-day free trial when approved, then pay PKR 1,500 a month (`lib/plans.ts`). Plans and sponsored campaigns are paid manually. For plans, shopkeepers pay by bank transfer, JazzCash or Easypaisa and submit the reference at `/shop/billing`, and an admin approves it at `/admin/subscriptions`. Set your account details there under "Payment instructions". A shop whose trial or plan has ended is hidden from search and can't take orders until a payment is approved. No card or wallet gateway is connected.
- **Maps.** Map tiles and the address search both use OpenStreetMap's free public services, which are only meant for light use. Before launch, switch to a commercial tile provider (`components/map/location-map.tsx` and `img-src` in `next.config.ts`) and a paid or self-hosted geocoder (`GEOCODER_URL`).
- **Proxy.** Rate limits are stored in MongoDB and shared across instances. Per-IP limits use `X-Forwarded-For`, so deploy behind a proxy that sets that header.
- **Assumptions to confirm.** Currency (`PKR`) and time zone (`Asia/Karachi`) are set in `lib/catalog.ts`, and the map's default center in `lib/geo.ts`.
- **Admin account.** Use a strong password for every admin account before launch.

For architecture and code conventions, see [`CLAUDE.md`](./CLAUDE.md).
