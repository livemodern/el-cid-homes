/**
 * Image variant URL builder, alt-text generator, and consolidated <img> props.
 *
 *  - imgOpt:           single-URL builder (Cloudflare transform OR Vercel optimizer)
 *  - imgSrcSet:        responsive srcset string for any URL
 *  - listingImageAlt:  generates SEO-friendly alt text from listing data
 *  - listingImageProps: spread-ready props for <img> tags on listing photos
 *
 * For images on our R2 + Cloudflare custom domain (images.mlrecloud.com),
 * imgOpt uses Cloudflare Image Transformations:
 *   https://images.mlrecloud.com/twocityplaza/123/01.jpg
 *     →  https://images.mlrecloud.com/cdn-cgi/image/width=640,quality=80,format=auto/twocityplaza/123/01.jpg
 *
 * For Trestle/Cotality CDN URLs (still un-migrated), imgOpt chains the auth
 * proxy through Vercel's image optimizer so they get resized + AVIF'd at the
 * edge — same as the R2 URLs would. End result: a 2 MB original Trestle JPEG
 * is served as a 30 KB AVIF card thumbnail or 200 KB lightbox image, cached
 * at the Vercel edge for a year.
 */

import { BUILDING_NAME } from '@/lib/building';

export const CF_IMAGES_HOST = 'images.mlrecloud.com';

// Hero <img> and its server-rendered preload (app/page.tsx) MUST share these
// widths + sizes so the browser resolves the SAME srcset candidate for both.
// A mismatch means the hero downloads twice — the exact bug this replaced
// (flat width=1920 CSS background discovered only after hydration, plus a
// second 2560 fetch: ~774KB of hero on a phone that needs ~120KB).
export const HERO_WIDTHS = [768, 1080, 1440, 1920, 2560];
export const HERO_SIZES = '100vw';

// MLS photo CDNs that require our server-side auth proxy. SHARED with
// app/api/proxy/image/route.ts — the proxy must accept exactly this set
// and nothing else (it attaches our Trestle bearer token to the fetch,
// so a loose check would hand the token to an attacker-controlled host).
// Strict suffix match on the HOSTNAME — `url.includes('cotality.com')`
// style checks match evil.com/?x=cotality.com.
const TRESTLE_HOSTS = ['cotality.com', 'paragonrels.com'];

export function isTrestleHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return TRESTLE_HOSTS.some(d => h === d || h.endsWith('.' + d));
}

// Neutral 4:3 grey placeholder for listings with no photos. An empty
// src='' makes browsers re-request the CURRENT PAGE as an image (real
// duplicate traffic + console errors), so never return '' from imgOpt.
export const PLACEHOLDER_IMG =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#e8e6e1"/></svg>');

export function imgOpt(url: string | undefined | null, width: number, quality: number = 80): string {
  if (!url) return PLACEHOLDER_IMG;

  try {
    const u = new URL(url);

    // R2 + Cloudflare Image Transforms (preferred path — once migration completes
    // every listing image URL will live on this host).
    if (u.hostname === CF_IMAGES_HOST) {
      const path = u.pathname.replace(/^\/+/, '');
      return `https://${CF_IMAGES_HOST}/cdn-cgi/image/width=${width},quality=${quality},format=auto/${path}`;
    }

    // Trestle/Cotality requires OAuth, so route through our server-side proxy
    // and chain that proxy URL through Vercel's image optimizer to get
    // resize + AVIF/WebP conversion + edge caching.
    if (isTrestleHost(u.hostname)) {
      const proxied = `/api/proxy/image?url=${encodeURIComponent(url)}`;
      return `/_next/image?url=${encodeURIComponent(proxied)}&w=${width}&q=${quality}`;
    }
  } catch {
    // Not a parseable absolute URL — fall through to optimizer fallback.
  }

  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

/**
 * Build a responsive srcset string from a single source URL.
 * Browser picks the right variant based on viewport + DPR.
 *
 * Widths must match `imageSizes` or `deviceSizes` in next.config.js
 * or /_next/image will reject with 400.
 */
export function imgSrcSet(
  url: string | undefined | null,
  widths: number[] = [640, 828, 1080, 1920],
  quality: number = 80
): string | undefined {
  if (!url) return undefined;
  return widths.map(w => `${imgOpt(url, w, quality)} ${w}w`).join(', ');
}

// ── Listing alt-text helpers ─────────────────────────────────────────────

type ListingForAlt = {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  unit_number?: string | null;
  building_name?: string | null;
};

// Photo index → likely room. MLS galleries follow a rough convention:
// cover/exterior, then interior rooms in living-first order.
// Anything past index 9 falls back to "view N".
const ROOM_LABELS = [
  'exterior',
  'living room',
  'kitchen',
  'primary bedroom',
  'primary bathroom',
  'view',
  'second bedroom',
  'balcony',
  'dining area',
  'living area',
];

/**
 * Generate SEO-friendly alt text for a listing photo.
 *
 *   listingImageAlt({ street_address: '550 Okeechobee Blvd', unit_number: '1608',
 *                     city: 'West Palm Beach' }, 0)
 *     → "550 Okeechobee Blvd Unit 1608, West Palm Beach — exterior"
 */
export function listingImageAlt(listing: ListingForAlt, idx: number = 0): string {
  // Trestle's street_address often already contains city/state/zip. Strip the
  // tail so we don't duplicate; we'll re-append city ourselves for cleanliness.
  let street = String(listing.street_address || '').trim().replace(/,$/, '');
  const city = String(listing.city || '').trim();
  if (city && street.toLowerCase().includes(city.toLowerCase())) {
    const i = street.toLowerCase().indexOf(city.toLowerCase());
    street = street.slice(0, i).trim().replace(/,$/, '');
  }

  // ...and it ALSO already ends in the unit number. "480 Hibiscus Street 221",
  // sometimes "480 Hibiscus Street Unit 229". Appending our own "Unit 221" on
  // top of that shipped alt text reading
  //     "480 Hibiscus Street 221 Unit 221, West Palm Beach, exterior"
  // and, in the "Unit 229" case,
  //     "480 Hibiscus Street Unit 229 Unit Unit 229, West Palm Beach, exterior"
  // on every listing card on the live site. Strip any trailing unit token first.
  // unit_number itself is dirty too — some rows store it as "Unit 229", not
  // "229", so a naive `Unit ${unit}` yields "Unit Unit 229". Normalise first.
  const unitRaw = String(listing.unit_number || '')
    .trim()
    .replace(/^(?:#|unit\s*)/i, '')
    .trim();
  if (unitRaw) {
    const esc = unitRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    street = street
      .replace(new RegExp(`[\\s,]*(?:#|unit\\s*)?${esc}$`, 'i'), '')
      .trim()
      .replace(/,$/, '');
  }

  const unit = unitRaw ? `Unit ${unitRaw}` : '';
  const label = idx < ROOM_LABELS.length ? ROOM_LABELS[idx] : `view ${idx + 1}`;

  // Lead with the building. It's what the page is about, it's the term people
  // search in image search, and it was missing entirely before.
  const head = [BUILDING_NAME, unit].filter(Boolean).join(' ');
  const place = [head, street, city].filter(Boolean).join(', ');

  return place ? `${place}, ${label}` : `${BUILDING_NAME} photo ${idx + 1}`;
}

// ── Spread-ready <img> props for a listing photo ─────────────────────────

type ImgProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  loading: 'lazy' | 'eager';
  decoding: 'async';
};

/**
 * Returns a complete set of <img> props for a listing photo:
 * src, srcSet, sizes, alt, loading=lazy (or eager), decoding=async.
 *
 * Use spread for clean call sites:
 *
 *   <img {...listingImageProps(listing, url, 0, { width: 640 })}
 *        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 */
export function listingImageProps(
  listing: ListingForAlt,
  url: string | null | undefined,
  idx: number = 0,
  opts: { width?: number; eager?: boolean; sizes?: string; widths?: number[] } = {}
): ImgProps {
  const width = opts.width ?? 800;
  return {
    src: imgOpt(url, width),
    srcSet: imgSrcSet(url, opts.widths),
    sizes: opts.sizes ?? '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw',
    alt: listingImageAlt(listing, idx),
    loading: opts.eager ? 'eager' : 'lazy',
    decoding: 'async',
  };
}


// ── Card-payload photo cap (ported from mlg-site 78d44c1, 2026-07-02) ──
// CardPhotos previews 5 slides but the full image_urls array (median ~36
// URLs) was being serialized into every card payload. Trim server-side;
// photos_total keeps the "View all N photos" pill accurate. Detail-page
// galleries never pass through this.
export const CARD_PHOTO_CAP = 5
export function trimCardPhotos<T extends { image_urls?: string[] | null }>(rows: T[]): T[] {
  for (const p of rows as any[]) {
    const n = p?.image_urls?.length ?? 0
    if (n) p.photos_total = n
    if (n > CARD_PHOTO_CAP) p.image_urls = p.image_urls.slice(0, CARD_PHOTO_CAP)
  }
  return rows
}
