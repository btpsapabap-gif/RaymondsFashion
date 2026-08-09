-- =========================================================
-- Intent-Based Raymond Fashion Shopping — Core Schema
-- Target: Supabase (Postgres + RLS)
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------- CATEGORIES ----------
-- Mirrors https://myraymond.com/collections
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- e.g. "Formal Shirts"
  slug text not null unique,          -- e.g. "formal-shirts"
  url text,                           -- canonical MyRaymond collection URL
  created_at timestamptz default now()
);

-- ---------- PRODUCTS ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  brand text not null default 'Raymond',   -- Raymond | Park Avenue | Parx | Colorplus etc.
  name text not null,                      -- e.g. "Raymond Men Blue Slim Fit Solid Formal Shirt"
  color text,
  pattern text,                            -- Solid | Checks | Stripe | Structure | Dobby ...
  fit text,                                -- Slim Fit | Regular Fit | Contemporary Fit ...
  fabric text,                             -- Cotton | Linen | Poly-Viscose ...
  sku text unique,
  price numeric(10,2) not null,            -- current selling price
  mrp numeric(10,2) not null,              -- printed MRP before discount
  discount_percent int generated always as (
    case when mrp > 0 then round(((mrp - price) / mrp) * 100) else 0 end
  ) stored,
  image_url text,
  product_url text,                        -- deep link back to myraymond.com
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_products_category on products (category_id);
create index if not exists idx_products_name on products using gin (to_tsvector('english', name));

-- ---------- PRODUCT VARIANTS (size-level inventory) ----------
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  size text not null,                      -- "S","M","L","XL","2XL" or waist "32","34" etc.
  stock_quantity int not null default 0,   -- total units in inventory
  held_quantity int not null default 0,    -- units currently held in pending orders
  status text default 'in_stock',          -- in_stock | low_stock | out_of_stock
  unique (product_id, size)
);

create index if not exists idx_variants_product on product_variants (product_id);

-- ---------- DISCOUNTS ----------
create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  code text unique,                        -- null = auto-applied instant discount
  description text,
  discount_type text not null,             -- flat | percent
  value numeric(10,2) not null,
  max_discount_amount numeric(10,2),
  applicable_category_id uuid references categories(id),
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean default true
);

-- ---------- CUSTOMERS (guest-checkout identity, keyed by email) ----------
-- Deliberately NOT tied to Supabase Auth: a chat-driven checkout shouldn't
-- require the shopper to already have a logged-in session. create_order
-- looks up (or creates) a row here by email, the same way a normal
-- guest-checkout e-commerce flow would. If you later add real accounts
-- (Supabase Auth / social login), add an optional `auth_user_id uuid
-- references auth.users(id)` column here and backfill it on login —
-- orders keep working unchanged either way.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  phone text,
  default_address jsonb,
  created_at timestamptz default now()
);

-- ---------- ORDERS ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  items jsonb not null,                    -- [{variant_id, product_id, size, quantity, unit_price}]
  num_items int not null,
  base_amount numeric(10,2) not null,
  discount_id uuid references discounts(id),
  discount_amount numeric(10,2) default 0,
  final_amount numeric(10,2) not null,
  status text default 'pending',           -- pending | confirmed | cancelled | expired
  shipping_address jsonb,
  source text default 'mcp',               -- mcp | web | app
  source_client text,                      -- e.g. "claude", "chatgpt"
  payment_provider text default 'razorpay',
  payment_link_id text,                    -- Razorpay payment_link id (plink_...)
  payment_link_url text,                   -- short_url the shopper actually pays on
  payment_ref text,                        -- Razorpay payment id (pay_...) once paid
  hold_expires_at timestamptz,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

create index if not exists idx_orders_payment_link on orders (payment_link_id);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
-- orders and customers are written exclusively by this MCP server, which
-- authenticates to Supabase with the service role key (bypasses RLS by
-- design — see src/db.ts). Enabling RLS with no permissive policy here
-- means anon/authenticated clients get zero direct access, which is the
-- right default for a guest-checkout table with no login session behind
-- it yet. If you add a customer-facing web/app login later, add policies
-- here scoped to whatever identity column you introduce (e.g. an
-- auth_user_id column on customers, see note above).
alter table orders enable row level security;
alter table customers enable row level security;

-- Public read-only catalog data
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table discounts enable row level security;

drop policy if exists "Public read categories" on categories;
drop policy if exists "Public read products" on products;
drop policy if exists "Public read variants" on product_variants;
drop policy if exists "Public read active discounts" on discounts;

create policy "Public read categories" on categories for select using (true);
create policy "Public read products" on products for select using (true);
create policy "Public read variants" on product_variants for select using (true);
create policy "Public read active discounts" on discounts for select using (is_active = true);

-- =========================================================
-- HELPER FUNCTION: release expired order holds (run on a schedule / cron)
-- Frees up held_quantity on variants for orders that were never paid.
-- =========================================================
create or replace function release_expired_holds() returns void as $$
declare
  o record;
  item jsonb;
begin
  for o in
    select * from orders
    where status = 'pending' and hold_expires_at < now()
  loop
    for item in select * from jsonb_array_elements(o.items)
    loop
      update product_variants
      set held_quantity = greatest(held_quantity - (item->>'quantity')::int, 0)
      where id = (item->>'variant_id')::uuid;
    end loop;

    update orders set status = 'expired' where id = o.id;
  end loop;
end;
$$ language plpgsql;

-- =========================================================
-- HELPER FUNCTION: finalize stock after payment confirmation
-- Decrements real stock_quantity and clears the hold for each item.
-- =========================================================
create or replace function decrement_variant_stock(p_variant_id uuid, p_qty int) returns void as $$
begin
  update product_variants
  set
    stock_quantity = greatest(stock_quantity - p_qty, 0),
    held_quantity = greatest(held_quantity - p_qty, 0),
    status = case when greatest(stock_quantity - p_qty, 0) = 0 then 'out_of_stock' else status end
  where id = p_variant_id;
end;
$$ language plpgsql;
