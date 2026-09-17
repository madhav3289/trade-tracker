# Trade Tracker API

A REST API for logging buy/sell transactions and generating profit & loss
reports — a small mirror of real-world "user activity logging + analytics +
automated reporting" backend work.

## Stack

Node.js, Express, PostgreSQL (raw SQL), JWT auth, bcrypt.

## Setup

1. `npm install`
2. Create a Postgres database (free options: [Neon](https://neon.tech), or run Postgres locally).
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
4. Run the schema: `psql $DATABASE_URL -f db/schema.sql`
   (or paste `db/schema.sql` into your DB provider's SQL editor).
5. Optional — seed demo data: `npm run seed`
   (creates `demo@example.com` / `demo1234` with 25 transactions).
6. `npm run dev` (or `npm start`) — server runs on `http://localhost:3000`.

## Schema

**users**: `id, email, password_hash, created_at`

**transactions**: `id, user_id, type (buy/sell), asset, quantity, price, occurred_at, created_at`

Indexed on `user_id` and `(user_id, asset)` since every query is scoped to
one user, and per-asset filtering is common.

## Endpoints

| Method | Path                  | Auth | Description                          |
|--------|-----------------------|------|---------------------------------------|
| POST   | /auth/signup          | No   | Create account, returns JWT           |
| POST   | /auth/login           | No   | Returns JWT                           |
| POST   | /transactions         | Yes  | Create a transaction                  |
| GET    | /transactions         | Yes  | List transactions (filter by `asset`, paginate with `limit`/`offset`) |
| GET    | /transactions/:id     | Yes  | Get one transaction                   |
| PUT    | /transactions/:id     | Yes  | Update a transaction                  |
| DELETE | /transactions/:id     | Yes  | Delete a transaction                  |
| GET    | /reports/summary      | Yes  | Overall + per-asset invested/returns/net P&L |
| GET    | /reports/monthly      | Yes  | P&L grouped by calendar month         |

Authenticated routes require `Authorization: Bearer <token>`.

## Example flow (curl)

```bash
# Sign up
curl -X POST localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"supersecret"}'

# Login
curl -X POST localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"supersecret"}'

# Create a transaction (use the token from above)
curl -X POST localhost:3000/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"buy","asset":"BTC","quantity":0.5,"price":60000}'

# Get the P&L summary
curl localhost:3000/reports/summary -H "Authorization: Bearer <token>"
```

## Test frontend

`public/index.html` is a bare HTML/JS page (no framework, no build step) for
manually checking that endpoints work — sign up, log in, create a
transaction, and view the reports, all from buttons instead of curl. It's
served automatically: once the server is running, open
`http://localhost:3000` in a browser. This isn't meant to be a real UI, just
a way to sanity-check the API without a terminal.

## Design

- **Auth**: JWT is stateless and scales horizontally without a shared
  session store — fits the microservices-style setup this mirrors. Passwords
  are hashed with bcrypt (salted, adaptive cost), never stored in plaintext.

- **Data isolation**: every query filters `WHERE user_id = $1` using the ID
  pulled from the verified JWT, not from the request body — so one user can
  never read or modify another user's data, even if they guess an ID.

- **Reporting**: uses SQL `SUM`/`GROUP BY`/`date_trunc` to aggregate at the
  database layer instead of pulling all rows into the app and summing in
  JS — this matters for performance once the transaction table gets large.

- **Simplification**: the P&L model here is "money out on buys vs. money in
  on sells," not full cost-basis/FIFO lot tracking. That's a known
  simplification worth naming if asked — a production version would track
  which specific lot each sell closes out.
  
- **Indexes**: `(user_id)` and `(user_id, asset)` composite index, since
  every single query is scoped by user and often filtered by asset too.

## Possible extensions

- Pagination metadata (total count) on `GET /transactions`
- Rate limiting on `/auth/login` (brute-force protection)
- Refresh tokens instead of a single 7-day JWT
- CSV export endpoint for reports