import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { browseCategories, browseCategoriesSchema } from "./tools/browseCategories.js";
import { searchProducts, searchProductsSchema } from "./tools/searchProducts.js";
import { getProductDetails, getProductDetailsSchema } from "./tools/getProductDetails.js";
import { checkStock, checkStockSchema } from "./tools/checkStock.js";
import { createOrder, createOrderSchema } from "./tools/createOrder.js";
import { confirmPayment, confirmPaymentSchema } from "./tools/confirmPayment.js";
import { fulfillOrder } from "./lib/fulfillOrder.js";
import { verifyWebhookSignature } from "./razorpay.js";

// Express's json() body-parser normally discards the raw request bytes once
// it's parsed them. The Razorpay webhook signature is computed over those
// exact raw bytes, so we capture them here via the `verify` hook before
// they're thrown away — req.body still gets the parsed JSON as usual.
declare module "express-serve-static-core" {
  interface Request {
    rawBody?: string;
  }
}

function buildServer() {
  const server = new McpServer({
    name: "raymond-fashion-shopping",
    version: "1.0.0",
  });

  server.tool(
    "browse_categories",
    "List all Raymond fashion collections available to shop (Formal Shirts, Casual Shirts, " +
      "Trousers & Chinos, T-Shirt & Polos, Jeans, Suits & Blazers, Shorts, Sweaters & Sweatshirts, " +
      "Jackets, Sleepwear). Call this when a user wants an overview of what's available or isn't sure " +
      "which category their need falls under.",
    browseCategoriesSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await browseCategories(args)) }] })
  );

  server.tool(
    "search_products",
    "Search the Raymond catalog for products by free-text query, category, color, size, price range, " +
      "or brand. Use this FIRST whenever a user expresses intent to shop, e.g. 'show me formal shirts', " +
      "'I need a blazer for a wedding', or 'blue jeans under 2000 rupees'.",
    searchProductsSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await searchProducts(args)) }] })
  );

  server.tool(
    "get_product_details",
    "Get full details for a single product — description attributes, pricing, and all size variants " +
      "with stock. Call this after search_products once the user has picked a specific product.",
    getProductDetailsSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getProductDetails(args)) }] })
  );

  server.tool(
    "check_stock",
    "Check live stock for a product, optionally narrowed to one size and quantity. Returns whether the " +
      "requested size/quantity is available, and suggests in-stock alternative sizes if not.",
    checkStockSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await checkStock(args)) }] })
  );

  server.tool(
    "create_order",
    "Hold the selected size variants, create (or reuse) a guest customer record by email, apply any " +
      "eligible discount, and generate a Razorpay payment link. Always ask the shopper for their email " +
      "before calling this — no account or login is required. Returns an order_id and a payment_link the " +
      "shopper pays on; send them that link. The order auto-confirms itself via Razorpay's webhook the " +
      "moment they pay, so you don't need to call confirm_payment afterward.",
    createOrderSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createOrder(args)) }] })
  );

  server.tool(
    "confirm_payment",
    "Manually finalize a pending order. Not needed in normal use — orders already auto-confirm via the " +
      "Razorpay webhook once paid. Only call this for local testing without a public webhook URL, or to " +
      "reconcile a payment whose webhook notification didn't arrive.",
    confirmPaymentSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await confirmPayment(args)) }] })
  );

  return server;
}

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf.toString("utf8");
    },
  })
);

// Razorpay calls this the moment a Payment Link is paid. We verify the
// signature against the raw body (captured above), then reuse the exact
// same fulfillment logic the confirm_payment tool uses, so an order always
// ends up in the same state regardless of which path confirmed it.
app.post("/webhooks/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (!verifyWebhookSignature(req.rawBody ?? "", signature)) {
    console.warn("Rejected Razorpay webhook: invalid or missing signature");
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const event = req.body;

  if (event.event === "payment_link.paid") {
    const orderId: string | undefined = event.payload?.payment_link?.entity?.reference_id;
    const paymentId: string | undefined = event.payload?.payment?.entity?.id;

    if (orderId && paymentId) {
      const result = await fulfillOrder(orderId, paymentId);
      if ((result as any).error && !(result as any).already_final) {
        console.error("Webhook could not fulfill order", orderId, (result as any).error);
      }
    } else {
      console.warn("payment_link.paid webhook missing reference_id or payment id", event.payload);
    }
  }

  // Razorpay only needs a 2xx to stop retrying; it doesn't read the body.
  res.json({ status: "ok" });
});

// Stateless mode: a fresh transport per request is the simplest, most robust
// way to run on serverless platforms like Vercel. For high-throughput use,
// switch to session-based transport with an event store (see MCP SDK docs).
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "raymond-fashion-mcp" });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Raymond fashion MCP server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
