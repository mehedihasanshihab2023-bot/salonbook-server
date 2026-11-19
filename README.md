# SalonBook Server — Salon Appointment Booking REST API

Backend for **SalonBook**, a salon appointment booking platform. Built with
Express.js, MongoDB (Mongoose), Better Auth, JWT, Stripe and ImgBB.

## Description

SalonBook lets customers browse salon services, request appointments and pay
for confirmed appointments through Stripe. Salon administrators manage
services, review appointment requests, confirm or cancel them, block abusive
customers and monitor payment transactions.

- **API base URL:** `/api/v1`
- **Response envelope:** successful responses return `{ data: ... }`, errors
  return `{ message: "..." }`
- **Auth:** Better Auth (`/api/auth/*`) for sessions, plus a signed JWT
  (httpOnly `salonbook_token` cookie) verified by the `requireAuth`
  middleware on every protected REST endpoint
- **Payments:** payment status is updated **only** by a verified Stripe
  webhook event (`checkout.session.completed`) — never by client requests

## Important Features

- Email/password authentication via Better Auth (min 6 chars, 1 uppercase,
  1 lowercase) with Google OAuth support
- JWT verification middleware + **server-side role verification**
  (`requireAdmin` / `requireCustomer`) on every protected API
- Blocked users lose access immediately (fresh DB read on every request,
  sessions revoked on block)
- Services CRUD (search by name, filter by category, sort by price —
  implemented server-side)
- Appointment booking with duplicate slot prevention (HTTP 409)
- Customers can only see / cancel / pay for **their own** appointments;
  admins confirm or cancel requests
- Stripe Checkout + webhook-only payment finalisation with idempotent
  transaction records
- ImgBB image hosting through a single authenticated upload endpoint
- Admin-only user management (block / unblock, admins are protected)
- Read-only admin transactions feed (records are created by the webhook only)
- Admin dashboard statistics endpoint

## Technology Stack

- Node.js + Express.js 5
- MongoDB with Mongoose
- Better Auth (email/password + Google)
- JWT (`jsonwebtoken`) for API authorization
- Stripe (Checkout + Webhooks)
- ImgBB (image hosting)
- Multer (in-memory upload buffering)
- CORS, cookie-parser, morgan, dotenv

## Collections

| Collection      | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `users`         | Better Auth users (`role`, `isBlocked`, `phoneNumber`) |
| `sessions` / `accounts` / `verifications` | Better Auth internals |
| `services`      | Salon services (`status: active/inactive`)          |
| `appointments`  | Booking requests (`pending/confirmed/cancelled`, `unpaid/paid`) |
| `transactions`  | Payment records created by the Stripe webhook only  |

## Installation

```bash
git clone <server-repo-url>
cd salonbook-server
npm install
cp .env.example .env   # then fill in the values
```

## Run Locally

```bash
# development (watch mode)
npm run dev

# production
npm start

# create the first administrator (admins can't self-register)
npm run create-admin -- "Admin Name" admin@salonbook.com "Password1"

# fill an empty database with the admin, a demo customer and 12 services
npm run seed-demo
```

> In development (`NODE_ENV` != `production`) the server automatically seeds
> the admin, a demo customer and the service catalogue when the database is
> empty, so a fresh start is always usable. Production admins are created
> securely with `npm run create-admin` — never through public registration.

> Local machine without MongoDB? Set `USE_MEMORY_DB=1` in `.env` to run
> against a throw-away in-memory database (data resets on restart).

### Demo accounts (development seed)

| Role | Email | Password |
| ---- | ----- | -------- |
| Admin | `admin@salonbook.com` | `Admin123` |
| Customer | `customer@salonbook.com` | `Customer123` |

These exist only when the development seed runs. Change or remove them before
any public deployment.

## Environment Variables

Create a `.env` file (never commit it) with the following **names**:

```
PORT
NODE_ENV
SERVER_URL
CLIENT_URL
MONGODB_URI
USE_MEMORY_DB
BETTER_AUTH_SECRET
JWT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
IMGBB_API_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
```

## API Overview

| Method | Path | Access |
| ------ | ---- | ------ |
| POST | `/api/v1/auth/token` | session → JWT cookie |
| POST | `/api/v1/auth/logout` | clears the API cookie |
| GET | `/api/v1/auth/me` | authenticated |
| GET | `/api/v1/services` | public (admin sees inactive too) |
| GET | `/api/v1/services/featured` | public |
| GET | `/api/v1/services/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/services/:id?` | admin |
| POST | `/api/v1/appointments` | customer |
| GET | `/api/v1/appointments/me` / `me/stats` | customer |
| GET | `/api/v1/appointments` | admin |
| PATCH | `/api/v1/appointments/:id/status` | admin |
| PATCH | `/api/v1/appointments/:id/cancel` | customer (own, pending) |
| POST | `/api/v1/payments/create-checkout-session` | customer (own, confirmed, unpaid) |
| POST | `/api/v1/payments/webhook` | Stripe (signature verified) |
| GET | `/api/v1/users` | admin |
| PATCH | `/api/v1/users/:id/block` | admin |
| GET | `/api/v1/transactions` | admin (read-only) |
| GET | `/api/v1/transactions/me` | customer (own, read-only) |
| GET | `/api/v1/stats/admin` | admin |
| POST | `/api/v1/uploads/image` | authenticated |
| GET | `/api/health` | public health probe |

## Deployment

1. **Database:** point `MONGODB_URI` at MongoDB Atlas (or another persistent
   deployment) and keep `USE_MEMORY_DB=0`.
2. **Secrets:** generate long random values for `BETTER_AUTH_SECRET` and
   `JWT_SECRET`; never reuse the development defaults.
3. **URLs:** set `SERVER_URL` to the public HTTPS API URL and `CLIENT_URL` to the
   deployed frontend URL. CORS accepts exactly those two origins with
   credentials enabled.
4. **Cookies:** in production the API and Better Auth cookies are issued with
   `SameSite=None; Secure`, so both the API and the client must be served over
   HTTPS. In local development they use `SameSite=Lax`.
5. **Stripe:** add a webhook endpoint pointing to
   `<SERVER_URL>/api/v1/payments/webhook` for the
   `checkout.session.completed` event, then copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`. Payment status never changes without a
   signature-verified event.
6. **Images:** set `IMGBB_API_KEY` to enable service and avatar uploads. Without
   it, uploads return a clear `503` and the UI falls back to an error toast.
7. **Admin:** provision the first administrator with
   `npm run create-admin -- "Admin Name" admin@example.com "StrongPassword1"`.

## Related

- Client repository: the SalonBook Next.js frontend (see its README for routes,
  demo accounts and environment variables).
