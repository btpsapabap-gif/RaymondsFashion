import { z } from "zod";
import { supabase } from "../db.js";
export const searchProductsSchema = {
    query: z
        .string()
        .optional()
        .describe("Free-text search on product name, e.g. 'formal shirt' or 'blazer'"),
    category_slug: z
        .string()
        .optional()
        .describe("Exact category slug, e.g. 'formal-shirts', 'casual-shirts', 'trousers-chinos', " +
        "'t-shirts-polos', 'jeans', 'suits-blazers', 'shorts', 'sweatshirts', 'jackets', 'sleepwear'. " +
        "Use browse_categories first if unsure of the exact slug."),
    color: z.string().optional().describe("Color filter, e.g. 'Blue', 'Black', 'White'"),
    size: z
        .string()
        .optional()
        .describe("Size filter, e.g. 'M', 'XL' for apparel or '34', '36' for trousers/jeans waist sizes"),
    min_price: z.number().optional().describe("Minimum selling price in INR"),
    max_price: z.number().optional().describe("Maximum selling price in INR"),
    brand: z
        .string()
        .optional()
        .describe("Brand filter, e.g. 'Raymond', 'Park Avenue'. Defaults to all Raymond Group brands."),
};
export async function searchProducts(args) {
    let query = supabase
        .from("products")
        .select(`
      id, name, brand, color, pattern, fit, fabric, price, mrp, discount_percent,
      sku, product_url, is_active,
      categories!inner ( id, name, slug ),
      product_variants ( id, size, stock_quantity, held_quantity, status )
    `)
        .eq("is_active", true);
    if (args.query) {
        query = query.ilike("name", `%${args.query}%`);
    }
    if (args.category_slug) {
        query = query.eq("categories.slug", args.category_slug);
    }
    if (args.color) {
        query = query.ilike("color", `%${args.color}%`);
    }
    if (args.brand) {
        query = query.ilike("brand", `%${args.brand}%`);
    }
    if (args.min_price !== undefined) {
        query = query.gte("price", args.min_price);
    }
    if (args.max_price !== undefined) {
        query = query.lte("price", args.max_price);
    }
    const { data, error } = await query.order("price", { ascending: true });
    if (error)
        return { error: error.message };
    let results = data ?? [];
    // Size filtering happens client-side since it's on the nested variants relation.
    if (args.size) {
        results = results
            .map((p) => ({
            ...p,
            product_variants: p.product_variants.filter((v) => v.size.toLowerCase() === args.size.toLowerCase()),
        }))
            .filter((p) => p.product_variants.length > 0);
    }
    return {
        result_count: results.length,
        products: results,
    };
}
