import { z } from "zod";
import { supabase } from "../db.js";
const orderItemSchema = z.object({
    variant_id: z.string().uuid().describe("Product variant ID (specific size) from check_stock or search_products"),
    quantity: z.number().int().positive().default(1).describe("Units of this size to order"),
});
export const createOrderSchema = {
    items: z.array(orderItemSchema).min(1).describe("List of {variant_id, quantity} the user wants to buy"),
    user_id: z.string().uuid().describe("Authenticated app user ID placing the order"),
    shipping_address: z
        .object({
        full_name: z.string(),
        line1: z.string(),
        line2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        pincode: z.string(),
        phone: z.string(),
    })
        .optional()
        .describe("Delivery address. Optional at hold time but required before confirm_payment in production."),
    discount_code: z
        .string()
        .optional()
        .describe("Optional discount/coupon code, e.g. 'MRFIRST'. If omitted, any active instant discount is applied automatically."),
    source_client: z
        .string()
        .optional()
        .describe("Which AI assistant initiated this order, e.g. 'claude', 'chatgpt' — for attribution/analytics"),
};
const HOLD_MINUTES = 15;
export async function createOrder(args) {
    const variantIds = args.items.map((i) => i.variant_id);
    // 1. Verify every variant exists and has enough available stock.
    const { data: variants, error: variantErr } = await supabase
        .from("product_variants")
        .select("id, product_id, size, stock_quantity, held_quantity, products ( name, price )")
        .in("id", variantIds);
    if (variantErr)
        return { error: variantErr.message };
    if (!variants || variants.length !== variantIds.length) {
        return { error: "One or more variant IDs are invalid." };
    }
    const insufficient = [];
    for (const item of args.items) {
        const v = variants.find((x) => x.id === item.variant_id);
        const available = Math.max(v.stock_quantity - v.held_quantity, 0);
        if (available < item.quantity) {
            insufficient.push({ variant_id: item.variant_id, available, requested: item.quantity });
        }
    }
    if (insufficient.length > 0) {
        return {
            error: "Some sizes don't have enough stock. Please re-check availability.",
            insufficient_stock: insufficient,
        };
    }
    // 2. Place a hold on each variant (increment held_quantity).
    for (const item of args.items) {
        const v = variants.find((x) => x.id === item.variant_id);
        const { error: holdErr } = await supabase
            .from("product_variants")
            .update({ held_quantity: v.held_quantity + item.quantity })
            .eq("id", item.variant_id);
        if (holdErr)
            return { error: holdErr.message };
    }
    // 3. Compute pricing.
    const orderItems = args.items.map((item) => {
        const v = variants.find((x) => x.id === item.variant_id);
        return {
            variant_id: item.variant_id,
            product_id: v.product_id,
            product_name: v.products?.name,
            size: v.size,
            quantity: item.quantity,
            unit_price: Number(v.products?.price ?? 0),
        };
    });
    const baseAmount = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    // 4. Resolve discount — explicit code, else any active auto-apply (code IS NULL) discount.
    let discount = null;
    if (args.discount_code) {
        const { data } = await supabase
            .from("discounts")
            .select("*")
            .eq("code", args.discount_code)
            .eq("is_active", true)
            .maybeSingle();
        discount = data;
    }
    else {
        const { data } = await supabase
            .from("discounts")
            .select("*")
            .is("code", null)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
        discount = data;
    }
    let discountAmount = 0;
    if (discount) {
        discountAmount =
            discount.discount_type === "percent"
                ? (baseAmount * Number(discount.value)) / 100
                : Number(discount.value);
        if (discount.max_discount_amount) {
            discountAmount = Math.min(discountAmount, Number(discount.max_discount_amount));
        }
    }
    const finalAmount = Math.max(baseAmount - discountAmount, 0);
    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
    // 5. Create the pending order record.
    const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
        user_id: args.user_id,
        items: orderItems,
        num_items: orderItems.reduce((sum, i) => sum + i.quantity, 0),
        base_amount: baseAmount,
        discount_id: discount?.id ?? null,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        status: "pending",
        shipping_address: args.shipping_address ?? null,
        source: "mcp",
        source_client: args.source_client ?? "unknown",
        hold_expires_at: holdExpiresAt,
    })
        .select()
        .single();
    if (orderErr)
        return { error: orderErr.message };
    return {
        order_id: order.id,
        status: "pending",
        items: orderItems,
        base_amount: baseAmount,
        discount_applied: discount ? { description: discount.description, amount: discountAmount } : null,
        final_amount: finalAmount,
        stock_held_for_minutes: HOLD_MINUTES,
        next_step: "Call confirm_payment with this order_id once payment is completed on the checkout link.",
    };
}
