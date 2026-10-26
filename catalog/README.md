# Official English catalog snapshot

Source: https://iresearch.com.sa/wp-json/wc/store/v1/products?per_page=100
Retrieved over verified HTTPS on 26 October 2026. The public response contained 49 entries; the 24 English permalink entries were retained for the user-confirmed English interface. Five are in the website's Bundle Packages category; nineteen are individual services. Products were `simple`, had no price range, used SAR with two minor digits, and supplied exact integer minor-unit prices.

`website.en.json` contains the names, descriptions converted to plain text, categories (including genuinely absent categories), official product URLs, IDs and prices from that response. No product names, categories or prices were invented. The original English logo was copied without modification.

The user explicitly confirmed displaying exact website prices (including SAR 8,000.55 and SAR 6,500.95) and **VAT included**. This is user confirmation of tax display, not an independent tax compliance assessment. Checkout is disabled.

Run `npm run catalog:import -- catalog/website.en.json` from the repository root after migrations. The source ID upsert prevents duplicate products; each import is audited. Do not scrape silently to update prices during task startup. Refresh the reviewed snapshot from the official source, preserve provenance and confirm any changed business facts with the user.

Catalog entries distinguish SERVICE and PACKAGE in a single catalog table; normalized package-component editing and price-version administration remain in the implementation plan.
