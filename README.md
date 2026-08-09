# Raymond Fashion Shopping MCP Server

An MCP (Model Context Protocol) server that lets any AI assistant — Claude,
ChatGPT (Developer Mode), or any other MCP-compatible client — browse
Raymond's fashion catalog, check size availability, and place orders with
discounts applied, directly inside the chat.

## How the trigger actually works

You are **not** trying to "intercept" what a user types into Claude or
ChatGPT — you can't, and no legitimate product does that. Instead:

1. You host this MCP server at a public URL.
2. The user (or Raymond's website/app) adds it as a connector inside their
   AI assistant — a one-time action, same as installing any app.
3. From then on, whenever the user's *intent* matches what your tools do
   (e.g. "I need a navy blazer for a wedding" or "show me Raymond formal
   shirts under 1500"), the assistant automatically decides to call your
   tools — because your tool descriptions tell it exactly when to use them
   (see the `description` fields in `src/index.ts`).

This is exactly how Claude, ChatGPT, VS Code, and other MCP clients already
discover and use third-party tools — it's an open, cross-platform standard
(donated by Anthropic to the Linux Foundation's Agentic AI Foundation),
not a Claude-only or ChatGPT-only mechanism.

## Project structure

```
fashion-mcp/
├── src/
│   ├── index.ts                    # MCP server: registers all 6 tools, HTTP transport, Razorpay webhook
│   ├── db.ts                       # Supabase client
│   ├── razorpay.ts                 # Razorpay Payment Links API client + webhook signature verification
│   ├── lib/
│   │   └── fulfillOrder.ts         # Shared "mark paid + deduct stock" logic (used by tool AND webhook)
│   └── tools/
│       ├── browseCategories.ts     # browse_categories
│       ├── searchProducts.ts       # search_products
│       ├── getProductDetails.ts    # get_product_details
│       ├── checkStock.ts           # check_stock
│       ├── createOrder.ts          # create_order (holds stock, resolves customer by email, creates payment link)
│       └── confirmPayment.ts       # confirm_payment (manual/testing override — see below)
├── supabase/
│   ├── schema.sql                  # Full DB schema: categories, products, variants, customers, orders, discounts, RLS
│   └── seed.sql                    # Sample data: 10 Raymond collections, ~20 products, sizes/stock, discounts
├── openapi/
│   └── actions.yaml                # Fallback spec for ChatGPT Custom GPT "Actions" (non-MCP path)
├── docs/
│   └── STRATEGY.md                 # Why MCP, and the full architecture rationale
├── .env.example
└── package.json
```

## The 6 tools this server exposes

| Tool | What it does |
|---|---|
| `browse_categories` | Lists all 10 Raymond collections (Formal Shirts, Casual Shirts, Trousers & Chinos, T-Shirt & Polos, Jeans, Suits & Blazers, Shorts, Sweaters & Sweatshirts, Jackets, Sleepwear) |
| `search_products` | Finds products by free-text query, category, color, size, price range, or brand — the entry point for any shopping intent |
| `get_product_details` | Full attributes + all size variants and stock for one product |
| `check_stock` | Checks a specific size/quantity is available and suggests in-stock alternative sizes if not |
| `create_order` | Holds selected size variants for 15 minutes, resolves/creates a **guest customer by email** (no login needed), applies discounts, and generates a **Razorpay payment link** |
| `confirm_payment` | Manual override only — see [Payments & checkout flow](#payments--checkout-flow) below |

## Payments & checkout flow

This is a **guest checkout**, not a login-gated one — an email address is all
`create_order` needs to identify (or create) the shopper. There's no
password, no OTP, no Supabase Auth account required.

1. `create_order` looks up (or creates) a row in `customers` by
   `customer_email`, holds the requested stock for 15 minutes, applies any
   discount, then calls the **Razorpay Payment Links API** and stores the
   resulting `payment_link_id` / `payment_link_url` on the order.
2. The tool returns that `payment_link` to the assistant — hand it straight
   to the shopper.
3. The shopper pays on Razorpay's own hosted page (no card details ever pass
   through this server or the assistant).
4. Razorpay sends a `payment_link.paid` webhook to
   `POST /webhooks/razorpay`. The server verifies the `X-Razorpay-Signature`
   header against `RAZORPAY_WEBHOOK_SECRET`, then calls the same
   `fulfillOrder()` logic the `confirm_payment` tool uses — marking the order
   `confirmed` and converting the held stock into a real deduction.

**`confirm_payment` is not part of the normal flow.** It exists for two
situations only: local development when you don't have a public URL for
Razorpay to send webhooks to, and manually reconciling a payment whose
webhook delivery failed. In both cases you pass the Razorpay payment id
(`pay_...`) you can find in the Razorpay Dashboard for that transaction.

### Setting up Razorpay

1. Create a Razorpay account and grab your **Key ID** / **Key Secret** from
   Dashboard → Settings → API Keys. Put them in `.env` as `RAZORPAY_KEY_ID`
   / `RAZORPAY_KEY_SECRET` (use the `rzp_test_` pair while developing).
2. Deploy the server (or use a tunnel like `ngrok` for local dev) so it has
   a public URL.
3. In Razorpay Dashboard → Settings → Webhooks, add a webhook pointing at
   `https://your-domain.com/webhooks/razorpay`, subscribe it to the
   **`payment_link.paid`** event, and set a secret. Put that same secret in
   `.env` as `RAZORPAY_WEBHOOK_SECRET`.
4. That's it — `create_order` will now hand back a real, payable link, and
   payments will confirm themselves.

## Seeded catalog

`supabase/seed.sql` seeds the 10 real MyRaymond collections
(see [myraymond.com/collections](https://myraymond.com/collections)):

- [Formal Shirts](https://myraymond.com/collections/formal-shirts)
- [Casual Shirts](https://myraymond.com/collections/casual-shirts)
- [Trousers & Chinos](https://myraymond.com/collections/trousers-chinos)
- [T-Shirt & Polos](https://myraymond.com/collections/t-shirts-polos)
- [Jeans](https://myraymond.com/collections/jeans)
- [Suits & Blazers](https://myraymond.com/collections/suits-blazers)
- [Shorts](https://myraymond.com/collections/shorts)
- [Sweaters & Sweatshirts](https://myraymond.com/collections/sweatshirts)
- [Jackets](https://myraymond.com/collections/jackets)
- [Sleepwear](https://myraymond.com/collections/sleepwear)

...with ~2-3 representative products per category (name, color, pattern,
fit, fabric, price/MRP/discount%, SKU) and size-level stock in
`product_variants`, plus three sample discounts (an instant 10% off, a
`MRFIRST` flat ₹100 coupon, and a category-specific `RAYMOND20` for Suits &
Blazers). This is **illustrative seed data**, styled after real MyRaymond
listings at time of writing — swap in a live catalog sync before production
(see `docs/STRATEGY.md`).

## Setup

```bash
npm install
cp .env.example .env
# fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, and
# RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET (see below)

# push schema to your Supabase project (via Supabase SQL editor, or CLI)
# 1. run supabase/schema.sql
# 2. run supabase/seed.sql   (optional, for test data)

npm run build
npm start
# Server listening on http://localhost:3000, MCP endpoint at /mcp
```

For local dev with hot reload: `npm run dev`

## Deploying

This is a stateless HTTP server (one transport per request), so it deploys
cleanly to Vercel, Render, Railway, or Fly.io. On Vercel specifically:

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables.
4. Vercel auto-builds via `npm run build` and serves `/mcp`.

Your public MCP endpoint will be: `https://your-domain.vercel.app/mcp`

## Connecting it to Claude

Claude.ai supports adding custom MCP connectors under **Settings →
Connectors → Add custom connector**, where you paste your server's URL
(`https://your-domain.com/mcp`). Once added, ask Claude to "show me Raymond
formal shirts under 1500" and it will call your tools automatically.

*(Exact menu names can shift — if you don't see this option, search
Anthropic's current docs at support.claude.com; I can pull the latest
steps for you if needed.)*

## Connecting it to ChatGPT

In ChatGPT, enable **Developer Mode** (Settings → Connectors → Advanced),
then add a custom MCP connector pointing at your `/mcp` URL. OpenAI shipped
full read/write MCP support in Developer Mode in September 2025, so
`create_order` and `confirm_payment` (write actions) work the same way
they do in Claude.

If you'd rather not use Developer Mode, build a Custom GPT instead and use
`openapi/actions.yaml` as its "Actions" schema — you'll need to add thin
REST route handlers in Express that call the same tool functions (the tool
logic in `src/tools/` is already framework-agnostic and reusable for this).

## Extending this

- **Payments**: wire `confirm_payment`'s `payment_ref` to a real
  Razorpay/Stripe webhook instead of trusting the client-supplied ref.
  Add a cron job (Supabase Edge Function or Vercel Cron) to call the
  `release_expired_holds()` SQL function every minute so abandoned holds
  free up.
- **More intent coverage**: add `cancel_order`, `get_order_status`,
  `list_my_orders`, `track_shipment` tools following the same pattern.
- **Live catalog**: replace the illustrative seed data with a sync job
  pulling real products/prices/stock from Raymond's actual commerce
  backend (Shopify Admin API, or internal PIM/ERP) on a schedule.
