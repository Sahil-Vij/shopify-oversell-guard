import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchVariants } from "../src/shopify.ts";

const node = (id: string) => ({
  id,
  sku: null,
  title: "Default",
  inventoryPolicy: "CONTINUE",
  inventoryQuantity: null,
  inventoryItem: { tracked: true },
  product: { title: "Mug", status: "ACTIVE", tags: ["a"] },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (nodes: unknown[], endCursor: string | null, hasNextPage: boolean) =>
  json({ data: { productVariants: { pageInfo: { hasNextPage, endCursor }, nodes } } });
const collect = async (fetch: typeof globalThis.fetch) => {
  const out = [];
  for await (const v of fetchVariants({ store: "s.myshopify.com", token: "t", fetch })) out.push(v);
  return out;
};

test("follows the cursor across pages and maps fields", async () => {
  const cursors: unknown[] = [];
  const responses = [page([node("1")], "c1", true), page([node("2")], "c2", false)];
  const variants = await collect(async (_url, init) => {
    cursors.push(JSON.parse(String(init?.body)).variables.cursor);
    return responses.shift()!;
  });

  assert.deepEqual(cursors, [null, "c1"]);
  assert.deepEqual(variants.map((v) => v.id), ["1", "2"]);
  assert.equal(variants[0].productTitle, "Mug");
  assert.equal(variants[0].tracked, true);
  assert.equal(variants[0].quantity, 0, "a null quantity becomes 0");
});

test("sends the token only in the header, to the store's admin endpoint", async () => {
  let seenUrl = "";
  let seenToken: string | null = null;
  await collect(async (url, init) => {
    seenUrl = String(url);
    seenToken = new Headers(init?.headers).get("X-Shopify-Access-Token");
    return page([], null, false);
  });
  assert.match(seenUrl, /^https:\/\/s\.myshopify\.com\/admin\/api\/[\d-]+\/graphql\.json$/);
  assert.equal(seenToken, "t");
});

test("throws on HTTP errors", async () => {
  await assert.rejects(collect(async () => json({}, 401)), /HTTP 401/);
});

test("throws on GraphQL errors", async () => {
  await assert.rejects(collect(async () => json({ errors: [{ message: "Throttled" }] })), /Throttled/);
});
