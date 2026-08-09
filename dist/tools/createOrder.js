import { z } from "zod";
import { supabase } from "../db.js";
import { createPaymentLink } from "../razorpay.js";
const orderItemSchema = z.object({
    variant_id: z.string().uuid().describe("Product variant ID (specific size) from check_stock or search_products"),
    quantity: z.number().int().positive().default(1).describe("Units of this size to order"),
});
export const createOrderSchema = {
    items: z.array(orderItemSchema).min(1).describe("List of {variant_id, quantity} the user wants to buy"),
    customer_email: z
        .string()
        .email()
        .describe("Shopper's email address. Always ask the user for this before calling create_order — it's how we " +
        "identify or create their customer record, and it's where the Razorpay payment link and receipt are sent."),
    customer_name: z
        .string()
        .optional()
        .describe("Shopper's full name — used on the payment link and shipping label."),
    customer_phone: z
        .string()
        .optional()
        .describe("Shopper's phone number, e.g. '+919876543210' — used for Razorpay SMS payment reminders."),
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
        .describe("Delivery address. Optional at hold time but required before the order ships."),
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
    // 2. Resolve or create the customer record by email (guest checkout — no login required).
    let customer = null;
    const { data: existingCustomer, error: lookupErr } = await supabase
        .from("customers")
        .select("id")
        .eq("email", args.customer_email)
        .maybeSingle();
    if (lookupErr)
        return { error: lookupErr.message };
    if (existingCustomer) {
        customer = existingCustomer;
        // Keep name/phone fresh if the shopper supplied new ones this time.
        if (args.customer_name || args.customer_phone) {
            await supabase
                .from("customers")
                .update({
                ...(args.customer_name ? { full_name: args.customer_name } : {}),
                ...(args.customer_phone ? { phone: args.customer_phone } : {}),
            })
                .eq("id", customer.id);
        }
    }
    else {
        const { data: newCustomer, error: insertErr } = await supabase
            .from("customers")
            .insert({
            email: args.customer_email,
            full_name: args.customer_name,
            phone: args.customer_phone,
        })
            .select("id")
            .single();
        if (insertErr)
            return { error: insertErr.message };
        customer = newCustomer;
    }
    // 3. Place a hold on each variant (increment held_quantity).
    for (const item of args.items) {
        const v = variants.find((x) => x.id === item.variant_id);
        const { error: holdErr } = await supabase
            .from("product_variants")
            .update({ held_quantity: v.held_quantity + item.quantity })
            .eq("id", item.variant_id);
        if (holdErr)
            return { error: holdErr.message };
    }
    // 4. Compute pricing.
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
    // 5. Resolve discount — explicit code, else any active auto-apply (code IS NULL) discount.
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
    // 6. Create the pending order record.
    const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
        customer_id: customer.id,
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
    // 7. Generate the Razorpay payment link. If Razorpay isn't configured or the
    // API call fails, the order still exists as a pending hold — surface the
    // problem clearly instead of silently returning no way to pay.
    try {
        const paymentLink = await createPaymentLink({
            amountInRupees: finalAmount,
            description: `Raymond order ${order.id.slice(0, 8)} — ${orderItems.length} item(s)`,
            customerName: args.customer_name,
            customerEmail: args.customer_email,
            customerPhone: args.customer_phone,
            referenceId: order.id,
        });
        await supabase
            .from("orders")
            .update({ payment_link_id: paymentLink.id, payment_link_url: paymentLink.short_url })
            .eq("id", order.id);
        return {
            order_id: order.id,
            status: "pending",
            items: orderItems,
            base_amount: baseAmount,
            discount_applied: discount ? { description: discount.description, amount: discountAmount } : null,
            final_amount: finalAmount,
            stock_held_for_minutes: HOLD_MINUTES,
            payment_link: paymentLink.short_url,
            next_step: "Send the shopper this payment_link to pay via Razorpay. The order auto-confirms via webhook once " +
                "paid — no need to call confirm_payment manually unless you're testing without a live webhook.",
        };
    }
    catch (err) {
        return {
            order_id: order.id,
            status: "pending",
            items: orderItems,
            base_amount: baseAmount,
            discount_applied: discount ? { description: discount.description, amount: discountAmount } : null,
            final_amount: finalAmount,
            stock_held_for_minutes: HOLD_MINUTES,
            warning: `Order created and stock held, but the Razorpay payment link could not be generated: ${err.message}`,
            next_step: "Fix the Razorpay configuration (RAZORPAY_KEY_ID/SECRET) and retry, or call confirm_payment manually once paid out-of-band.",
        };
    }
}
