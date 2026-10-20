import type { DeepPartial, SiteConfig } from './config';

/**
 * YOUR store's settings — the one config file you edit. List ONLY what you
 * change; everything else inherits the defaults in `config.ts`. These values
 * are deep-merged on top of those defaults (arrays replace wholesale).
 *
 * Upstream (the template) never edits this file, so pulling template updates
 * won't conflict with your settings. See `store.config.example.ts` for the
 * build-time customization surface. Common overrides:
 *
 *   currency: 'zar',   // ISO 4217 code, lowercase — not the symbol
 *   images: { maxWidth: 1000 },
 *   orderNumber: { offset: 1000 },
 *
 * Operational switches and integrations belong in Admin → Settings.
 */
export const storeOverrides: DeepPartial<SiteConfig> = {
  currency: 'zar',
  // South Africa only for now. Amounts are in cents (R99.00 = 9900). Once the
  // first save is made in Admin → Shipping, that runtime copy replaces this.
  shipping: {
    enabled: true,
    zones: [
      {
        countries: ['ZA'],
        rates: [{ label: 'Standard delivery (The Courier Guy / PUDO)', amountCents: 9900 }],
        freeOverCents: 100000, // free delivery from R1,000
      },
    ],
  },
};
