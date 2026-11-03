import type { Variant } from "./audit.ts";

export interface ShopifyConfig {
  store: string;
  token: string;
  apiVersion?: string;
  fetch?: typeof globalThis.fetch;
}

const VARIANTS_QUERY = `query Variants($cursor: String) {
  productVariants(first: 250, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      sku
      title
      inventoryPolicy
      inventoryQuantity
      inventoryItem { tracked }
      product { title status tags }
    }
  }
}`;

interface VariantNode {
  id: string;
  sku: string | null;
  title: string;
  inventoryPolicy: Variant["inventoryPolicy"];
  inventoryQuantity: number | null;
  inventoryItem: { tracked: boolean };
  product: { title: string; status: string; tags: string[] };
}

interface VariantsPage {
  data?: {
    productVariants: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: VariantNode[];
    };
  };
  errors?: { message: string }[];
}

/** Reads every variant in the store, one page at a time. Read-only. */
export async function* fetchVariants(config: ShopifyConfig): AsyncGenerator<Variant> {
  const doFetch = config.fetch ?? globalThis.fetch;
  const url = `https://${config.store}/admin/api/${config.apiVersion ?? "2026-04"}/graphql.json`;
  let cursor: string | null = null;

  while (true) {
    const response: Response = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": config.token },
      body: JSON.stringify({ query: VARIANTS_QUERY, variables: { cursor } }),
    });
    if (!response.ok) throw new Error(`Shopify responded with HTTP ${response.status}`);

    const page = (await response.json()) as VariantsPage;
    if (page.errors?.length) throw new Error(`Shopify GraphQL error: ${page.errors[0].message}`);
    if (!page.data) throw new Error("Shopify response had no data");

    for (const node of page.data.productVariants.nodes) {
      yield {
        id: node.id,
        sku: node.sku,
        title: node.title,
        productTitle: node.product.title,
        productStatus: node.product.status,
        productTags: node.product.tags,
        inventoryPolicy: node.inventoryPolicy,
        tracked: node.inventoryItem.tracked,
        quantity: node.inventoryQuantity ?? 0,
      };
    }

    const { hasNextPage, endCursor } = page.data.productVariants.pageInfo;
    if (!hasNextPage) return;
    cursor = endCursor;
  }
}
