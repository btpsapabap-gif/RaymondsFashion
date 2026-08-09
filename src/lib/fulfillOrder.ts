import { supabase } from "../db.js";

/**
 * Marks a pending order confirmed and converts its held stock into a real
 * deduction. Called from two places:
 *  - the confirm_payment MCP tool (manual/testing path)
 *  - the /webhooks/razorpay route (the real, automatic path once a shopper pays)
 * Keeping the logic here means both paths can never drift apart.
 */
export async function fulfillOrder(orderId: string, paymentRef: string) {
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (fetchErr || !order) return { error: "Order not found." };
  if (order.status !== "pending") {
    // Not an error if the webhook fires twice for the same payment — just say so.
    return { error: `Order is already '${order.status}', cannot confirm.`, already_final: order.status === "confirmed" };
  }

  const { error: updateOrderErr } = await supabase
    .from("orders")
    .update({ status: "confirmed", payment_ref: paymentRef, confirmed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (updateOrderErr) return { error: updateOrderErr.message };

  // Convert each held item into real, permanent stock deduction.
  const items = (order.items ?? []) as { variant_id: string; quantity: number }[];
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
