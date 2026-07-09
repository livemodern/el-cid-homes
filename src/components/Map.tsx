'use client';

/**
 * Single-pin Mapbox map for listing detail pages.
 *
 * Renders a Mapbox GL JS map centered on (lat, lng) with one branded pin.
 * Designed to be dynamically imported with ssr: false so the ~200KB mapbox
 * bundle only loads when a user opens the Location tab — not on every
 * listing page view.
 *
 * Usage:
 *   const ListingMap = dynamic(() => import('@/components/Map'), { ssr: false });
 *   <ListingMap lat={26.7142} lng={-80.0535} address="550 Okeechobee Blvd, ..." />
 *
 * Token is hardcoded inline because it's a publishable pk.* token — same
 * pattern as the search page. If we ever rotate it, change it in both
 * places (or move to NEXT_PUBLIC_MAPBOX_TOKEN env var).
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

const NAVY = '#0D173B';
const TEAL = '#00B2CC';

type Props = {
  lat: number | null | undefined;
  lng: number | null | undefined;
  address?: string;
  height?: number;
  zoom?: number;
};

export default function ListingMap({ lat, lng, address, height = 420, zoom = 15 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (mapRef.current) return; // guard against re-init in React strict mode

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [lng, lat],
      zoom,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.scrollZoom.disable();   // avoid hijacking page scroll; user double-clicks/uses controls
    map.on('click', () => map.scrollZoom.enable());

    // ── Custom branded pin ────────────────────────────────────────────────
    // Two-element pin: outer ring + filled center dot. Pure CSS so we don't
    // need to ship an SVG asset; sized to match the editorial style.
    const el = document.createElement('div');
    el.style.cssText = [
      'width:24px', 'height:24px', 'border-radius:50%',
      `background:${TEAL}`, `border:3px solid #fff`,
      'box-shadow:0 0 0 2px ' + NAVY + ', 0 4px 12px rgba(0,0,0,0.2)',
      'cursor:pointer',
    ].join(';');

    new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, zoom]);

  // No coords → friendly empty state instead of a broken-looking map
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', color: '#94a3b8', fontSize: 13,
        borderRadius: 12, border: '1px solid #e2e8f0',
      }}>
        Map unavailable for this listing
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={address ? `Map of ${address}` : 'Property location map'}
      style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}
    />
  );
}

// mapbox token build marker: re-inline NEXT_PUBLIC_MAPBOX_TOKEN (20260704-144921)
