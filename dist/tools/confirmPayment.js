import { z } from "zod";
import { supabase } from "../db.js";
export const confirmPaymentSchema = {
    order_id: z.string().uuid().describe("The pending order ID returned by create_order"),
    payment_ref: z.string().describe("Payment gateway reference/transaction ID confirming successful payment"),
};
export async function confirmPayment(args) {
    const { data: order, error: fetchErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", args.order_id)
        .single();
    if (fetchErr || !order)
        return { error: "Order not found." };
    if (order.status !== "pending") {
        return { error: `Order is already '${order.status}', cannot confirm.` };
    }
    const { error: updateOrderErr } = await supabase
        .from("orders")
        .update({ status: "confirmed", payment_ref: args.payment_ref, confirmed_at: new Date().toISOString() })
        .eq("id", args.order_id);
    if (updateOrderErr)
        return { error: updateOrderErr.message };
    // Convert each held item into real, permanent stock deduction.
    const items = (order.items ?? []);
    for (const item of items) {
        const { error: decrementErr } = await supabase.rpc("decrement_variant_stock", {
            p_variant_id: item.variant_id,
            p_qty: item.quantity,
        });
        // Non-fatal if the RPC doesn't exist yet — order status is already the source of truth.
        if (decrementErr) {
            console.warn("decrement_variant_stock RPC failed for", item.variant_id, decrementErr.message);
        }
    }
    return {
        order_id: order.id,
        status: "confirmed",
        final_amount: order.final_amount,
        message: "Order confirmed! Your Raymond order is being processed for shipping.",
    };
}
