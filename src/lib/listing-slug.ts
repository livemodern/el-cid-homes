// SEO-friendly slugs for listing detail URLs.
// Pattern: /listings/<street>-<city>-<state>-<zip>-<mls_id>
//   e.g.   /listings/701-s-olive-ave-1605-west-palm-beach-fl-33401-1155418813
//
// The trailing numeric segment is the MLS ID — that's what we use to look up
// the property. Old URLs that are just the bare MLS ID (e.g. /listings/1155418813)
// keep working because the [slug] route still matches them.

type ListingMin = {
  mls_id: string | number;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export function slugifyListing(p: ListingMin): string {
  const street = String(p.street_address || '').trim();
  const city = String(p.city || '').trim();

  // Trestle's `street_address` (mapped from UnparsedAddress) often already
  // contains "<street> <unit> <city> <state> <zip>". If it does, don't append
  // city/state/zip again or we'd get duplicated tokens in the URL slug.
  const streetIncludesCity = !!city && street.toLowerCase().includes(city.toLowerCase());

  const parts = streetIncludesCity
    ? [street, p.mls_id]
    : [street, city, p.state, p.zip, p.mls_id];

  return parts
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function listingHref(p: ListingMin): string {
  return '/listings/' + slugifyListing(p);
}

// Extract the MLS ID from a slug. Handles:
//   - new format:  701-s-olive-ave-...-1155418813  → "1155418813"
//   - bare ID:     1155418813                       → "1155418813"
export function mlsIdFromSlug(slug: string): string {
  const m = slug.match(/-(\d+)$/);
  if (m) return m[1];
  if (/^\d+$/.test(slug)) return slug;
  return slug;
}
