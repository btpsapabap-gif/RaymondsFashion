import { z } from "zod";
import { supabase } from "../db.js";

export const getProductDetailsSchema = {
  product_id: z.string().uuid().describe("The product ID returned by search_products"),
};

export async function getProductDetails(args: { product_id: string }) {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, brand, color, pattern, fit, fabric, price, mrp, discount_percent,
      sku, image_url, product_url, is_active,
      categories!inner ( id, name, slug, url ),
      product_variants ( id, size, stock_quantity, held_quantity, status )
    `
    )
    .eq("id", args.product_id)
    .single();

  if (error) return { error: error.message };

  const variants = (data.product_variants ?? []).map((v: any) => ({
    ...v,
    available_quantity: Math.max(v.stock_quantity - v.held_quantity, 0),
  }));

  return { ...data, product_variants: variants };
}
