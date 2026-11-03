import { parseArgs } from "node:util";
import { auditVariants, formatReport, type Variant } from "./audit.ts";
import { fetchVariants } from "./shopify.ts";

const USAGE = "Usage: npm run audit -- [--exclude-tag <tag>]... [--json]";

async function main(): Promise<number> {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      "exclude-tag": { type: "string", multiple: true },
      json: { type: "boolean", default: false },
    },
  });

  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!store || !token) {
    console.error(`Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN (see .env.example).\n${USAGE}`);
    return 2;
  }

  const variants: Variant[] = [];
  for await (const variant of fetchVariants({ store, token })) variants.push(variant);

  const result = auditVariants(variants, { excludeTags: values["exclude-tag"] });
  console.log(values.json ? JSON.stringify(result, null, 2) : formatReport(result));
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
