-- =========================================================
-- Reset script — drops everything this project created so
-- schema.sql can be run again from a clean slate.
--
-- Safe to run even if only some tables exist (e.g. you're
-- upgrading from an older version of schema.sql that used
-- "app_users" instead of "customers") — every DROP uses
-- IF EXISTS so nothing errors out.
--
-- Run this, then supabase/schema.sql, then supabase/seed.sql.
-- =========================================================

drop table if exists orders cascade;
drop table if exists customers cascade;
drop table if exists app_users cascade;       -- older schema version, if present
drop table if exists product_variants cascade;
drop table if exists products cascade;
drop table if exists discounts cascade;
drop table if exists categories cascade;

drop function if exists release_expired_holds();
drop function if exists decrement_variant_stock(uuid, int);
