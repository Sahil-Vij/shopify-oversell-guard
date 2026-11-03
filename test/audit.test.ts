import assert from "node:assert/strict";
import { test } from "node:test";
import { auditVariants, formatReport, type Variant } from "../src/audit.ts";

const variant = (overrides: Partial<Variant> = {}): Variant => ({
  id: "gid://shopify/ProductVariant/1",
  sku: "SKU-1",
  title: "Default",
  productTitle: "Blue Mug",
  productStatus: "ACTIVE",
  productTags: [],
  inventoryPolicy: "DENY",
  tracked: true,
  quantity: 5,
  ...overrides,
});

test("flags tracked variants that continue selling at zero", () => {
  const result = auditVariants([variant({ inventoryPolicy: "CONTINUE" }), variant()]);
  assert.equal(result.scanned, 2);
  assert.equal(result.atRisk.length, 1);
});

test("adds up oversold units, even when the policy is already DENY", () => {
  const result = auditVariants([variant({ quantity: -3 }), variant({ quantity: -7 }), variant({ quantity: 0 })]);
  assert.equal(result.oversold.length, 2);
  assert.equal(result.unitsOversold, 10);
});

test("ignores untracked variants, whose quantity means nothing", () => {
  const result = auditVariants([variant({ tracked: false, inventoryPolicy: "CONTINUE", quantity: -9 })]);
  assert.equal(result.scanned, 1);
  assert.equal(result.atRisk.length, 0);
  assert.equal(result.oversold.length, 0);
});

test("skips products that aren't active", () => {
  const result = auditVariants([variant({ productStatus: "DRAFT", inventoryPolicy: "CONTINUE" })]);
  assert.equal(result.scanned, 0);
  assert.equal(result.atRisk.length, 0);
});

test("excluded tags match case-insensitively and are counted", () => {
  const result = auditVariants(
    [variant({ productTags: ["Preorder"], inventoryPolicy: "CONTINUE", quantity: -1 })],
    { excludeTags: ["preorder"] },
  );
  assert.equal(result.excluded, 1);
  assert.equal(result.atRisk.length, 0);
  assert.equal(result.oversold.length, 0);
});

test("report lists the worst oversold variant first and handles a missing SKU", () => {
  const report = formatReport(
    auditVariants([variant({ quantity: -2 }), variant({ sku: null, title: "Red", quantity: -8 })]),
  );
  assert.match(report, /Already oversold: 2 variants, 10 units/);
  assert.ok(report.indexOf("Red (no SKU)") < report.indexOf("Default (SKU-1)"));
});
