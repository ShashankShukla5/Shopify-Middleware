# Shopify Kefi Backend

Node.js / Express service for the Kefi practitioner checkout flow:

- `POST /api/shopify/create-draft-order` — create a Shopify Draft Order from cart + markup and return `invoiceUrl`
- `POST /webhooks/orders-create` — verify HMAC, optionally auto-send an invoice

---

## Project structure

```
src/
  server.js                          # process entry: load config, listen
  app.js                             # Express app wiring
  config/index.js                    # env + runtime config
  clients/shopifyGraphQL.js          # shared Admin GraphQL client
  graphql/                           # query/mutation documents
  services/                          # business logic
  validators/                        # request validation
  middleware/                        # HMAC, error handler
  routes/                            # thin HTTP handlers
  utils/                             # GIDs, money, HMAC, GraphQL helpers
  errors/AppError.js
.env.example
package.json
README.md
```

Routes are thin. Pricing, Shopify calls, and invoice sending live in services.

---

## Install

```bash
npm install
```

Requires **Node.js 18+** (uses global `fetch`).

---

## Environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `SHOPIFY_SHOP_DOMAIN` | Store domain, e.g. `your-store.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Admin API access token (`shpat_...`) with at least `read_orders` |
| `SHOPIFY_API_VERSION` | Admin API version, e.g. `2025-07` |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret from the Shopify app / notification settings |
| `PORT` | HTTP port (default `3000`) |

Optional but useful for vaulted payment method details: `read_payment_mandate`.

**Secrets are never written to logs.**

---

## Run the server

```bash
npm start
```

Or with auto-reload:

```bash
npm run dev
```

You should see:

```
Listening on http://localhost:3000
Health:            GET  /health
Orders webhook:    POST /webhooks/orders-create
```

---

## Register the `orders/create` webhook

Point Shopify at:

```text
POST https://<your-public-host>/webhooks/orders-create
```

### Option A — Shopify Admin (custom app notifications)

1. Create / open a custom app with Admin API access (`read_orders`).
2. Install the app on the store and copy the Admin API access token into `.env`.
3. In the app’s webhook / notification settings, subscribe to **Order creation** (`orders/create`).
4. Set the callback URL to your public HTTPS endpoint above.
5. Copy the **webhook signing secret** into `SHOPIFY_WEBHOOK_SECRET`.

### Option B — Shopify CLI / Partner app webhook subscription

Subscribe to topic `ORDERS_CREATE` (or `orders/create`) with the same callback URL, then use that app’s API credentials and webhook secret.

### Local development (tunnel)

Shopify cannot reach `localhost` directly. Expose the server with a tunnel, for example:

```bash
npx cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

Then register:

```text
https://<tunnel-host>/webhooks/orders-create
```

---

## How the webhook is verified

Shopify HMAC verification uses the **exact raw request body**.

This POC mounts the webhook route with `express.raw({ type: 'application/json' })` **before** any `express.json()` parser, so:

1. Raw bytes are available as a `Buffer`
2. HMAC is verified with `crypto.createHmac('sha256', secret)` → Base64, compared with `crypto.timingSafeEqual`
3. Only after verification is the body parsed as JSON

Do not change that order when editing the server.

---

## How to test

### 1. Health check

```bash
curl http://localhost:3000/health
```

### 2. Real unpaid order (preferred)

1. Start the server and tunnel.
2. Ensure the `orders/create` webhook is registered to the tunnel URL.
3. Create a prescription / checkout flow through Kefi that results in a **Payment pending** Shopify order (Admin shows Collect payment / Send invoice).
4. Watch the server console when the webhook arrives.

### 3. Manual HMAC smoke test (optional)

Only useful to confirm the endpoint rejects bad signatures:

```bash
curl -X POST http://localhost:3000/webhooks/orders-create \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: invalid" \
  -d "{\"id\":123}"
```

Expected: `401 Unauthorized`.

---

## What to look for in the console

For each webhook the server prints, in order:

1. **RAW WEBHOOK PAYLOAD (orders/create)** — full webhook JSON  
2. **COMPLETE GRAPHQL RESPONSE** — full Admin GraphQL JSON (separate from the webhook)  
3. **PAYMENT COLLECTION INFORMATION** — focused payment fields, including:

```text
additionalPaymentCollectionUrl: <value or null>
```

4. Plus:
   - `displayFinancialStatus`
   - totals / outstanding balance
   - `paymentGatewayNames`
   - `paymentCollectionDetails`
   - `paymentTerms`
   - `transactions`

5. Final summary:

```text
ORDER RECEIVED
--------------
Order: #1214
Shopify Order ID: gid://shopify/Order/...
Financial Status: PENDING
Total: $XX.XX AUD

PAYMENT COLLECTION TEST
-----------------------
additionalPaymentCollectionUrl: <URL/null>

RESULT:
PAYMENT COLLECTION URL FOUND
```

or:

```text
RESULT:
NO PAYMENT COLLECTION URL FOUND
```

### How to interpret the result

| Console result | Meaning |
|---|---|
| `PAYMENT COLLECTION URL FOUND` + URL | Admin GraphQL exposed a usable customer payment/collection URL for that existing order. |
| `NO PAYMENT COLLECTION URL FOUND` | Field was `null`, missing, or unavailable after querying. Do **not** invent a workaround in this POC. |
| GraphQL field stripped / error logged | The configured API version or scopes do not support that field. Remaining fields are still fetched. |

Important context from Shopify’s docs: `additionalPaymentCollectionUrl` lives under `order.paymentCollectionDetails` and is commonly used when an order needs additional payment (for example after edits / outstanding balance). This POC reports whatever Shopify actually returns for a normal unpaid/`PENDING` order — it does not assume the URL will exist.

---

## GraphQL behavior

- Uses Admin **GraphQL** only (no REST order fetch for diagnostics).
- Version comes from `SHOPIFY_API_VERSION`.
- Primary field under test:

```graphql
paymentCollectionDetails {
  additionalPaymentCollectionUrl
}
```

- If a requested field is unsupported for the API version/scopes, the service logs the GraphQL error, removes that field, and retries so the rest of the diagnostic payload still returns.

---

## Scopes checklist

Minimum:

- `read_orders`

Helpful for richer payment diagnostics:

- `read_payment_mandate` (for `vaultedPaymentMethods`)
- `read_customers` (customer details, if restricted on your app)

---

## Success criteria for this POC

You can answer **yes** or **no** to:

> Can our backend retrieve a usable customer payment/collection URL for an existing unpaid Shopify order created by Kefi, using only `orders/create` + Admin GraphQL, without creating a Draft Order or modifying the order?

Use the console `RESULT:` line as the authoritative answer for each test order.
