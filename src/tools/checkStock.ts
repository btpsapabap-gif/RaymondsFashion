import { z } from "zod";
import { supabase } from "../db.js";

export const checkStockSchema = {
  product_id: z.string().uuid().describe("The product ID to check size/stock availability for"),
  size: z
    .string()
    .optional()
    .describe("Specific size the user wants, e.g. 'M' or '34'. If omitted, returns all sizes."),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How many units the user wants — used to confirm enough stock is available"),
};

export async function checkStock(args: { product_id: string; size?: string; quantity?: number }) {
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, size, stock_quantity, held_quantity, status")
    .eq("product_id", args.product_id)
    .order("size", { ascending: true });

  if (error) return { error: error.message };

  const withAvailability = (data ?? []).map((v) => ({
    ...v,
    available_quantity: Math.max(v.stock_quantity - v.held_quantity, 0),
  }));

  if (!args.size) {
    return {
      product_id: args.product_id,
      sizes: withAvailability,
    };
  }

  const match = withAvailability.find((v) => v.size.toLowerCase() === args.size!.toLowerCase());

  if (!match) {
    return {
      error: `Size '${args.size}' is not offered for this product.`,
      available_sizes: withAvailability.filter((v) => v.available_quantity > 0).map((v) => v.size),
    };
  }

  const requestedQty = args.quantity ?? 1;
  const inStock = match.available_quantity >= requestedQty;

  return {
    product_id: args.product_id,
    size: match.size,
    available_quantity: match.available_quantity,
    requested_quantity: requestedQty,
    in_stock: inStock,
    variant_id: match.id,
    alternative_sizes_in_stock: inStock
      ? []
      : withAvailability.filter((v) => v.available_quantity > 0).map((v) => v.size),
  };
}
