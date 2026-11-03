export interface Variant {
  id: string;
  sku: string | null;
  title: string;
  productTitle: string;
  productStatus: string;
  productTags: string[];
  inventoryPolicy: "DENY" | "CONTINUE";
  tracked: boolean;
  quantity: number;
}

export interface AuditOptions {
  /** Products with any of these tags are skipped, e.g. preorders. Case-insensitive, like Shopify tags. */
  excludeTags?: string[];
}

export interface AuditResult {
  scanned: number;
  excluded: number;
  /** Tracked variants that keep selling at zero stock. */
  atRisk: Variant[];
  /** Tracked variants already below zero. */
  oversold: Variant[];
  unitsOversold: number;
}

export function auditVariants(variants: Iterable<Variant>, options: AuditOptions = {}): AuditResult {
  const excludedTags = new Set((options.excludeTags ?? []).map((tag) => tag.toLowerCase()));
  const result: AuditResult = { scanned: 0, excluded: 0, atRisk: [], oversold: [], unitsOversold: 0 };

  for (const variant of variants) {
    if (variant.productStatus !== "ACTIVE") continue;
    result.scanned += 1;

    if (variant.productTags.some((tag) => excludedTags.has(tag.toLowerCase()))) {
      result.excluded += 1;
      continue;
    }
    // Shopify doesn't count stock for untracked variants, so their quantity means nothing.
    if (!variant.tracked) continue;

    if (variant.inventoryPolicy === "CONTINUE") result.atRisk.push(variant);
    if (variant.quantity < 0) {
      result.oversold.push(variant);
      result.unitsOversold += -variant.quantity;
    }
  }
  return result;
}

export function formatReport(result: AuditResult): string {
  const label = (v: Variant) => `${v.productTitle} / ${v.title} (${v.sku ?? "no SKU"})`;
  const lines = [
    `Scanned ${result.scanned} active variants, excluded ${result.excluded}.`,
    `Can oversell: ${result.atRisk.length}`,
    `Already oversold: ${result.oversold.length} variants, ${result.unitsOversold} units`,
  ];
  if (result.oversold.length > 0) {
    lines.push("", "Worst oversold:");
    const worst = [...result.oversold].sort((a, b) => a.quantity - b.quantity).slice(0, 10);
    for (const v of worst) lines.push(`  ${v.quantity}  ${label(v)}`);
  }
  return lines.join("\n");
}
