import crypto from "node:crypto";
import "dotenv/config";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

function authHeader(): string {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error(
      "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Copy .env.example to .env and fill in your Razorpay API keys (Dashboard -> Settings -> API Keys)."
    );
  }
  return "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}

export interface RazorpayPaymentLink {
  id: string; // plink_...
  short_url: string;
  status: string;
}

/**
 * Creates a Razorpay Payment Link for a given order and returns the
 * hosted checkout URL the shopper pays on. Uses the Payment Links API
 * (https://razorpay.com/docs/api/payments/payment-links/) rather than
 * raw Orders + Checkout.js, since a chat-driven flow just needs a single
 * URL to hand back — no client-side JS integration required.
 */
export async function createPaymentLink(params: {
  amountInRupees: number;
  description: string;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  referenceId: string; // our internal order id, so the webhook can match it back
  callbackUrl?: string;
}): Promise<RazorpayPaymentLink> {
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: Math.round(params.amountInRupees * 100), // Razorpay wants paise
      currency: "INR",
      accept_partial: false,
      description: params.description,
      customer: {
        name: params.customerName || undefined,
        email: params.customerEmail,
        contact: params.customerPhone || undefined,
      },
      notify: { sms: !!params.customerPhone, email: true },
      reference_id: params.referenceId,
      callback_url: params.callbackUrl || undefined,
      callback_method: params.callbackUrl ? "get" : undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || `Razorpay API error (${res.status})`);
  }
  return { id: data.id, short_url: data.short_url, status: data.status };
}

/**
 * Verifies the X-Razorpay-Signature header on an incoming webhook against
 * the raw request body, using the webhook secret configured in the
 * Razorpay Dashboard (Settings -> Webhooks). Always verify this before
 * trusting a webhook payload — see src/index.ts's /webhooks/razorpay route.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
