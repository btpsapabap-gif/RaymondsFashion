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
    "Hold the selected size variants and create a pending order with any applicable discount applied. " +
      "Returns an order_id and final price. This does NOT charge the user yet — call confirm_payment after " +
      "the payment link is completed.",
    createOrderSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await createOrder(args)) }] })
  );

  server.tool(
    "confirm_payment",
    "Finalize a pending order after payment has been completed, converting held stock into a confirmed, " +
      "shippable order.",
    confirmPaymentSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await confirmPayment(args)) }] })
  );

  return server;
}

const app = express();
app.use(express.json());

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
