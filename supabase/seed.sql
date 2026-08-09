-- =========================================================
-- Sample seed data for local/dev testing
-- Categories mirror https://myraymond.com/collections
-- Product names/prices/discount % are styled after real MyRaymond
-- listings (e.g. formal-shirts) at the time of writing; refresh via
-- the catalog-sync script for live pricing before going to production.
-- =========================================================

-- ---------- CATEGORIES ----------
insert into categories (id, name, slug, url) values
  ('c0000001-0000-0000-0000-000000000001', 'Formal Shirts',            'formal-shirts',    'https://myraymond.com/collections/formal-shirts'),
  ('c0000001-0000-0000-0000-000000000002', 'Casual Shirts',            'casual-shirts',    'https://myraymond.com/collections/casual-shirts'),
  ('c0000001-0000-0000-0000-000000000003', 'Trousers & Chinos',        'trousers-chinos',  'https://myraymond.com/collections/trousers-chinos'),
  ('c0000001-0000-0000-0000-000000000004', 'T-Shirt & Polos',          't-shirts-polos',   'https://myraymond.com/collections/t-shirts-polos'),
  ('c0000001-0000-0000-0000-000000000005', 'Jeans',                    'jeans',            'https://myraymond.com/collections/jeans'),
  ('c0000001-0000-0000-0000-000000000006', 'Suits & Blazers',          'suits-blazers',    'https://myraymond.com/collections/suits-blazers'),
  ('c0000001-0000-0000-0000-000000000007', 'Shorts',                   'shorts',           'https://myraymond.com/collections/shorts'),
  ('c0000001-0000-0000-0000-000000000008', 'Sweaters & Sweatshirts',   'sweatshirts',      'https://myraymond.com/collections/sweatshirts'),
  ('c0000001-0000-0000-0000-000000000009', 'Jackets',                  'jackets',          'https://myraymond.com/collections/jackets'),
  ('c0000001-0000-0000-0000-000000000010', 'Sleepwear',                'sleepwear',        'https://myraymond.com/collections/sleepwear')
on conflict (id) do nothing;

-- ---------- PRODUCTS ----------
-- Formal Shirts
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a1000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Raymond', 'Raymond Men Blue Slim Fit Dobby Formal Shirt',   'Blue',   'Dobby', 'Slim Fit',    'Cotton Blend', 'RAY-FS-1001', 1039.00, 1999.00, 'https://myraymond.com/collections/formal-shirts'),
  ('a1000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'Raymond', 'Raymond Men Maroon Slim Fit Dobby Formal Shirt', 'Maroon', 'Dobby', 'Slim Fit',    'Cotton Blend', 'RAY-FS-1002',  902.00, 2099.00, 'https://myraymond.com/collections/formal-shirts'),
  ('a1000000-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 'Raymond', 'Raymond Men White Slim Fit Solid Formal Shirt',  'White',  'Solid', 'Slim Fit',    'Cotton',       'RAY-FS-1003', 1151.00, 2399.00, 'https://myraymond.com/collections/formal-shirts')
on conflict (id) do nothing;

-- Casual Shirts
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a2000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'Raymond', 'Raymond Men Green Regular Fit Checked Casual Shirt', 'Green', 'Checks', 'Regular Fit', 'Cotton',       'RAY-CS-2001', 899.00, 1799.00, 'https://myraymond.com/collections/casual-shirts'),
  ('a2000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', 'Raymond', 'Raymond Men Khaki Slim Fit Solid Casual Shirt',      'Khaki', 'Solid',  'Slim Fit',    'Linen Blend',  'RAY-CS-2002', 949.00, 1899.00, 'https://myraymond.com/collections/casual-shirts')
on conflict (id) do nothing;

-- Trousers & Chinos
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a3000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000003', 'Raymond', 'Raymond Men Khaki Slim Fit Solid Chino',     'Khaki', 'Solid', 'Slim Fit',    'Cotton Lycra', 'RAY-TR-3001', 1299.00, 2499.00, 'https://myraymond.com/collections/trousers-chinos'),
  ('a3000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000003', 'Raymond', 'Raymond Men Navy Regular Fit Formal Trouser', 'Navy',  'Solid', 'Regular Fit', 'Poly Viscose', 'RAY-TR-3002', 1399.00, 2699.00, 'https://myraymond.com/collections/trousers-chinos')
on conflict (id) do nothing;

-- T-Shirt & Polos
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a4000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'Raymond', 'Raymond Men White Solid Polo T-Shirt',       'White', 'Solid',   'Regular Fit', 'Cotton',  'RAY-TP-4001', 599.00, 1199.00, 'https://myraymond.com/collections/t-shirts-polos'),
  ('a4000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000004', 'Raymond', 'Raymond Men Black Slim Fit Printed T-Shirt', 'Black', 'Printed', 'Slim Fit',    'Cotton',  'RAY-TP-4002', 649.00, 1299.00, 'https://myraymond.com/collections/t-shirts-polos')
on conflict (id) do nothing;

-- Jeans
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a5000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000005', 'Raymond', 'Raymond Men Blue Slim Fit Jeans',  'Blue',  'Solid', 'Slim Fit', 'Denim', 'RAY-JN-5001', 1499.00, 2999.00, 'https://myraymond.com/collections/jeans'),
  ('a5000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000005', 'Raymond', 'Raymond Men Black Slim Fit Jeans', 'Black', 'Solid', 'Slim Fit', 'Denim', 'RAY-JN-5002', 1599.00, 3199.00, 'https://myraymond.com/collections/jeans')
on conflict (id) do nothing;

-- Suits & Blazers
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a6000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000006', 'Raymond', 'Raymond Men Navy Blue Regular Fit Solid Suit',        'Navy Blue',     'Solid',   'Regular Fit', 'Wool Blend', 'RAY-SB-6001', 5999.00, 12999.00, 'https://myraymond.com/collections/suits-blazers'),
  ('a6000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000006', 'Raymond', 'Raymond Men Charcoal Grey Slim Fit Checked Blazer',   'Charcoal Grey', 'Checked', 'Slim Fit',    'Wool Blend', 'RAY-SB-6002', 4499.00,  9999.00, 'https://myraymond.com/collections/suits-blazers')
on conflict (id) do nothing;

-- Shorts
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a7000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000007', 'Raymond', 'Raymond Men Grey Solid Casual Shorts',  'Grey', 'Solid',   'Regular Fit', 'Cotton', 'RAY-SH-7001', 799.00, 1499.00, 'https://myraymond.com/collections/shorts'),
  ('a7000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000007', 'Raymond', 'Raymond Men Navy Printed Shorts',       'Navy', 'Printed', 'Regular Fit', 'Cotton', 'RAY-SH-7002', 849.00, 1599.00, 'https://myraymond.com/collections/shorts')
on conflict (id) do nothing;

-- Sweaters & Sweatshirts
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a8000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000008', 'Raymond', 'Raymond Men Maroon Solid Pullover Sweater',    'Maroon',      'Solid', 'Regular Fit', 'Acrylic Wool', 'RAY-SW-8001', 1299.00, 2499.00, 'https://myraymond.com/collections/sweatshirts'),
  ('a8000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000008', 'Raymond', 'Raymond Men Grey Melange Hooded Sweatshirt',   'Grey Melange','Solid', 'Regular Fit', 'Cotton Fleece','RAY-SW-8002', 1399.00, 2699.00, 'https://myraymond.com/collections/sweatshirts')
on conflict (id) do nothing;

-- Jackets
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('a9000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000009', 'Raymond', 'Raymond Men Black Solid Bomber Jacket', 'Black', 'Solid',   'Regular Fit', 'Polyester', 'RAY-JK-9001', 2999.00, 5999.00, 'https://myraymond.com/collections/jackets'),
  ('a9000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000009', 'Raymond', 'Raymond Men Navy Quilted Jacket',       'Navy',  'Quilted', 'Regular Fit', 'Polyester', 'RAY-JK-9002', 3299.00, 6499.00, 'https://myraymond.com/collections/jackets')
on conflict (id) do nothing;

-- Sleepwear
insert into products (id, category_id, brand, name, color, pattern, fit, fabric, sku, price, mrp, product_url) values
  ('aa000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000010', 'Raymond', 'Raymond Men Blue Striped Night Suit Set', 'Blue', 'Striped', 'Regular Fit', 'Cotton', 'RAY-SL-A001', 999.00, 1799.00, 'https://myraymond.com/collections/sleepwear'),
  ('aa000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000010', 'Raymond', 'Raymond Men Grey Solid Lounge Pyjama',    'Grey', 'Solid',   'Regular Fit', 'Cotton', 'RAY-SL-A002', 849.00, 1599.00, 'https://myraymond.com/collections/sleepwear')
on conflict (id) do nothing;

-- ---------- PRODUCT VARIANTS (size x stock) ----------
-- Shirts / T-Shirts / Sweaters / Jackets / Sleepwear use S,M,L,XL,2XL
-- Trousers / Jeans use waist sizes; Suits/Blazers use chest sizes

do $$
declare
  p record;
  shirt_sizes text[] := array['S','M','L','XL','2XL'];
  waist_sizes text[] := array['30','32','34','36','38'];
  chest_sizes text[] := array['38','40','42','44'];
  sizes text[];
  s text;
  i int;
begin
  for p in select id, category_id from products loop
    if p.category_id in (
      'c0000001-0000-0000-0000-000000000003', -- Trousers & Chinos
      'c0000001-0000-0000-0000-000000000005'  -- Jeans
    ) then
      sizes := waist_sizes;
    elsif p.category_id = 'c0000001-0000-0000-0000-000000000006' then -- Suits & Blazers
      sizes := chest_sizes;
    else
      sizes := shirt_sizes;
    end if;

    i := 0;
    foreach s in array sizes loop
      i := i + 1;
      insert into product_variants (product_id, size, stock_quantity, held_quantity, status)
      values (
        p.id,
        s,
        case when i = array_length(sizes, 1) then 0 else 8 + (i * 3) end, -- last size sold out, for a realistic mix
        0,
        case when i = array_length(sizes, 1) then 'out_of_stock' else 'in_stock' end
      )
      on conflict (product_id, size) do nothing;
    end loop;
  end loop;
end $$;

-- ---------- DISCOUNTS ----------
-- Note: the first row (code = null, auto-applied instant discount) has no
-- unique constraint to conflict on since Postgres allows multiple NULLs in
-- a unique column — re-running this file will insert a harmless duplicate
-- of just that one row (create_order only ever picks one via `limit(1)`).
insert into discounts (code, description, discount_type, value, is_active) values
  (null,        'Instant 10% off on all orders',            'percent', 10,  true)
on conflict do nothing;

insert into discounts (code, description, discount_type, value, is_active) values
  ('MRFIRST',   'Flat ₹100 off on your first order',        'flat',    100, true),
  ('RAYMOND20', 'Extra 20% off on Suits & Blazers',          'percent', 20,  true)
on conflict (code) do nothing;

update discounts set applicable_category_id = 'c0000001-0000-0000-0000-000000000006'
  where code = 'RAYMOND20';
