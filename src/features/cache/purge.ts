import { cache, env } from 'cloudflare:workers';
import { normalizeCacheTags, productCacheTags } from './tags';

/**
 * Workers Caching is only turned on for a store that declares CANONICAL_ORIGIN
 * (see wrangler.jsonc). Without it nothing is cached, so a failed purge has no
 * stale content to invalidate — and must not turn an admin write that already
 * landed in D1 into a 500.
 */
function cachingActive(): boolean {
  return Boolean(env.CANONICAL_ORIGIN);
}

export interface CachePurger {
  purge(options: CachePurgeOptions): Promise<CachePurgeResult>;
}

function purgeFailure(
  mode: 'tags' | 'stock-tags' | 'everything',
  errors: CachePurgeError[] | unknown,
): void {
  console.error(
    JSON.stringify({
      event: 'workers_cache_purge_failed',
      mode,
      errors,
    }),
  );
}

/**
 * Invalidate low-frequency content mutations synchronously after their D1
 * write. A failed tag purge falls back to the whole entrypoint cache; if that
 * also fails, the handler fails rather than silently accepting stale content —
 * but only when caching is active. With caching off there is nothing stale to
 * protect, so the failure is logged and the save completes.
 */
export async function purgeCacheTags(
  tags: Iterable<string>,
  purger: CachePurger = cache,
  strict: boolean = cachingActive(),
): Promise<void> {
  const normalized = normalizeCacheTags(tags);
  if (normalized.length === 0) return;

  try {
    const result = await purger.purge({ tags: normalized });
    if (result.success) return;
    purgeFailure('tags', result.errors);
  } catch (error) {
    purgeFailure('tags', error instanceof Error ? error.message : String(error));
  }

  try {
    const fallback = await purger.purge({ purgeEverything: true });
    if (fallback.success) return;
    purgeFailure('everything', fallback.errors);
  } catch (error) {
    purgeFailure('everything', error instanceof Error ? error.message : String(error));
  }

  if (!strict) return;
  throw new Error('The data was saved, but the Workers cache could not be invalidated.');
}

export function purgeProductCache(
  productPublicIds: Iterable<string | null | undefined>,
  purger?: CachePurger,
  strict?: boolean,
): Promise<void> {
  return purgeCacheTags(productCacheTags(productPublicIds), purger, strict);
}

/** Purge the owning Worker entrypoint's complete cache after a deployment. */
export async function purgeEntireCache(
  purger: CachePurger = cache,
): Promise<void> {
  try {
    const result = await purger.purge({ purgeEverything: true });
    if (result.success) return;
    purgeFailure('everything', result.errors);
  } catch (error) {
    purgeFailure('everything', error instanceof Error ? error.message : String(error));
  }
  throw new Error('The Workers cache could not be purged.');
}

/**
 * Inventory transitions are checkout-frequency events. Purge only the narrow
 * product tags and never fall back to purge-everything: if Cloudflare rate
 * limits this best-effort request, the bounded shared TTL is the safety net.
 */
export async function purgeStockProductCache(
  productPublicIds: Iterable<string | null | undefined>,
  purger: CachePurger = cache,
): Promise<void> {
  const tags = productCacheTags(productPublicIds);
  if (tags.length === 0) return;

  try {
    const result = await purger.purge({ tags });
    if (result.success) return;
    purgeFailure('stock-tags', result.errors);
  } catch (error) {
    purgeFailure('stock-tags', error instanceof Error ? error.message : String(error));
  }
}
