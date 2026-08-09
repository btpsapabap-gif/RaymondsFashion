import { z } from "zod";
import { fulfillOrder } from "../lib/fulfillOrder.js";
export const confirmPaymentSchema = {
    order_id: z.string().uuid().describe("The pending order ID returned by create_order"),
    payment_ref: z
        .string()
        .describe("Razorpay payment id (starts 'pay_') confirming successful payment. You normally won't need to call " +
        "this tool — orders auto-confirm the moment Razorpay reports the payment link as paid, via the " +
        "/webhooks/razorpay route. Use this only as a manual override: local testing without a public " +
        "webhook URL, or reconciling a payment whose webhook delivery failed."),
};
export async function confirmPayment(args) {
    return fulfillOrder(args.order_id, args.payment_ref);
}
