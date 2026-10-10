# Aqua

Aqua is a responsive website that connects customers with verified local water shops. Customers find shops near them, order water for delivery, and track their orders. Shopkeepers manage their shop, products, stock, orders and sales reports. Admins verify shops, manage users and orders, and see platform revenue.

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

### Testing on a phone

Start the dev server and open `http://<your-computer's-LAN-IP>:3000` on a phone on the same Wi-Fi. Everything works except **"My location"**: browsers only share location on secure (`https://`) pages, so on plain HTTP the button explains this and points to the map search instead. To test GPS on a phone, use HTTPS:

- **Tunnel (most reliable):** run `npx cloudflared tunnel --url http://localhost:3000` (or ngrok) and open the `https://…trycloudflare.com` address it prints. These hosts are already allowed in `next.config.ts`.
- **`npm run dev:https`:** self-signed HTTPS on your LAN IP. The phone shows a certificate warning that you must accept, and some browsers may still refuse location after that.

On the real site (served over HTTPS) location works normally.

Optional demo data around a location:

```bash
npm run db:seed -- --lat 31.5204 --lng 74.3587
```

Demo shops are created as verified, except one left pending so the review queue has something in it. Shops that real shopkeepers register start as **pending** until an admin verifies them at `/admin/shops`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, and serve the production build |
| `npm run dev:https` | Dev server over self-signed HTTPS on your network, for testing "My location" on a phone |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Unit and integration tests. Integration tests start an in-memory MongoDB automatically. |
| `npm run db:indexes` | Sync database indexes. Run it after pulling changes that add models or indexes. |
| `npm run db:seed` | Demo shops and products (development only) |
| `npm run user:create-admin` | Create an admin account (prints a one-time password) |
| `npm run shop:set-status` | Change a shop's status from the command line (prefer the admin panel) |

## Accounts and roles

- **Customers** sign up at `/register`, save delivery addresses, order, track, cancel (before the shop accepts) and review deliveries.
- **Shopkeepers** sign up at `/register` (or "Register your shop" on `/pricing`), then register their shop at `/shop/profile`. The shop appears publicly once an admin verifies it. They can close it temporarily (Overview) or delete it permanently (Shop profile).
- **Admins** are created only with `npm run user:create-admin`. There's no password reset email yet: admins create one-time reset links from `/admin/users/<id>`.

## Production notes

- **Payments.** Customer orders are cash on delivery. Shop plans are billed manually: shopkeepers pay by bank transfer, JazzCash or Easypaisa and submit the reference at `/shop/billing`, and an admin approves it at `/admin/subscriptions`. Set your account details there under "Payment instructions". "Require an active plan to be listed" is an admin switch that starts off. No card or wallet gateway is connected.
- **Maps.** Map tiles and the address search both use OpenStreetMap's free public services, which are only meant for light use. Before launch, switch to a commercial tile provider (`components/map/location-map.tsx` and `img-src` in `next.config.ts`) and a paid or self-hosted geocoder (`GEOCODER_URL`).
- **Proxy.** Rate limits are stored in MongoDB and shared across instances. Per-IP limits use `X-Forwarded-For`, so deploy behind a proxy that sets that header.
- **Assumptions to confirm.** Currency (`PKR`), time zone (`Asia/Karachi`) and plan prices are set in `lib/catalog.ts` and `lib/plans.ts`.

For architecture and code conventions, see [`CLAUDE.md`](./CLAUDE.md).
