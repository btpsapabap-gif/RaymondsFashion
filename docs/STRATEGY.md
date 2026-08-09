# Why MCP for Raymond fashion shopping

## The problem with "intercepting" a chat

You cannot make Claude or ChatGPT secretly watch for someone typing "I need a
formal shirt" and hijack the conversation. No legitimate product works that
way, and any implementation that tried would be against every major
assistant's terms of service.

What you *can* do — and what this project does — is host an MCP server that
exposes well-described tools. Once a user (or Raymond's own website/app)
connects that server to their assistant, the assistant's own reasoning
decides when the user's intent matches a tool, based entirely on the
`description` fields you write. That's the same mechanism every third-party
MCP integration uses (Slack, Notion, Asana, Google Drive, etc.) — it's an
open, cross-platform standard, not a Claude-only or ChatGPT-only hook.

## Why the tool descriptions matter more than the code

An assistant chooses to call `search_products` because its description says
"Use this FIRST whenever a user expresses intent to shop." If the wording is
vague, the assistant may never call it, even though the underlying SQL is
perfect. Treat `src/index.ts`'s tool descriptions as product copy, not
boilerplate — they are the entire interface between user intent and your
catalog.

## Why a "hold" step exists between browsing and paying

Apparel inventory is finite per size. Two conversations could try to buy the
last size-M `Raymond Men Blue Slim Fit Dobby Formal Shirt` at the same time.
`create_order` places a **soft hold** (`held_quantity` on the variant) for
15 minutes rather than immediately decrementing stock, so:

- The user gets a firm price and confirmation the size exists.
- Nobody else can also "win" the last unit while payment is in flight.
- If payment never completes, `release_expired_holds()` (a scheduled SQL
  function) frees the hold back into available stock automatically.

Real stock (`stock_quantity`) is only decremented in `confirm_payment`, after
a real payment reference exists — mirroring how you'd want a checkout to
behave with a real payment gateway (Razorpay/Stripe) in front of it.

## Why categories are seeded from the real MyRaymond taxonomy

The 10 categories in `supabase/seed.sql` mirror
[myraymond.com/collections](https://myraymond.com/collections) exactly
(Formal Shirts, Casual Shirts, Trousers & Chinos, T-Shirt & Polos, Jeans,
Suits & Blazers, Shorts, Sweaters & Sweatshirts, Jackets, Sleepwear) so the
category vocabulary the assistant sees matches what a shopper would recognize
from the real site, and `product_url` on each row points back to the real
collection page for that category.

## Why checkout is guest/email-based, not login-gated

The first version of this project required a pre-existing Supabase Auth
`user_id` (a UUID) before `create_order` would work. In practice that meant
a chat user had no way to actually buy anything — there was no signup flow,
and asking someone to hand an assistant a raw internal UUID isn't a
reasonable checkout experience.

`create_order` now takes a `customer_email` instead. It looks up (or
creates) a row in a dedicated `customers` table keyed by email —
deliberately **not** wired to Supabase Auth. This mirrors how most
e-commerce "guest checkout" flows work: no password, no session, no signup
step, just an email so there's somewhere to send the receipt and payment
link. If you later add real accounts, add an optional `auth_user_id`
column to `customers` and backfill it on login; orders keep working
unchanged either way.

## Why payment confirmation happens over a webhook, not a tool call

`confirm_payment` used to be the only way to mark an order paid — the
assistant would have to somehow obtain a payment reference and call it
manually. That's backwards: the assistant isn't present at the moment the
shopper actually pays (they've left the chat to complete checkout on
Razorpay's hosted page), so there's nothing for it to call at the right
time.

Instead, `create_order` generates a **Razorpay Payment Link**, and Razorpay
itself notifies the server via a `payment_link.paid` webhook the instant
payment succeeds — regardless of whether the assistant, or even the same
conversation, is still around. `POST /webhooks/razorpay` verifies the
request really came from Razorpay (HMAC signature check against
`RAZORPAY_WEBHOOK_SECRET`) and then calls the same `fulfillOrder()`
function the `confirm_payment` tool uses, so both paths always leave an
order in an identical state. `confirm_payment` still exists as a manual
escape hatch for local testing or webhook-delivery failures — it's just no
longer the primary path.

## Extending this into a real, live catalog

The seed data is illustrative (a handful of representative SKUs per
category, styled after real MyRaymond listings at the time of writing).
For production:

1. Build a catalog-sync job that pulls live products/prices/stock from
   Raymond's actual commerce backend (Shopify Admin API, if MyRaymond runs
   on Shopify, or their internal PIM/ERP) into `products` /
   `product_variants` on a schedule.
2. Wire `confirm_payment`'s `payment_ref` to a real Razorpay/Stripe webhook
   instead of trusting the client-supplied ref.
3. Add a cron job (Supabase Edge Function or Vercel Cron) to call
   `release_expired_holds()` every minute.
4. Add `cancel_order`, `get_order_status`, `list_my_orders`, and
   `track_shipment` tools following the same pattern for full post-purchase
   coverage.
