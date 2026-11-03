# shopify-oversell-guard

Find Shopify variants that can sell stock you don't have.

A tracked variant set to "continue selling when out of stock" takes orders at zero, and stock goes negative. That means
cancellations, refunds and unhappy customers, and the setting is easy to miss across a big catalog.

## Status

Early and under active development. The audit is **read-only**. So far it's only been tested against mocked API responses,
not a real store. See [issues](../../issues) for the roadmap.

## Usage

Requires Node 24+ and an Admin API token with `read_products`.

```sh
cp .env.example .env   # add your store and token
npm run audit -- --exclude-tag preorder
```

Example output, with made-up numbers:

```text
Scanned 500 active variants, excluded 12.
Can oversell: 340
Already oversold: 25 variants, 96 units
```

Add `--json` for machine-readable output.

## What counts

| Finding | Rule |
| --- | --- |
| Can oversell | Active, tracked, policy is `CONTINUE` |
| Already oversold | Active, tracked, quantity below zero |

Untracked variants and products with an excluded tag are skipped.

## Development

```sh
npm install
npm test
npm run typecheck
```

## License

MIT
