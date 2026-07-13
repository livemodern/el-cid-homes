'use client';

// ─── BuildingAlertsButton ─────────────────────────────────────────────
// Small "Get alerts" trigger that opens BuildingAlerts in a modal.
// Lives next to the For Sale / For Rent pills on the community/building
// page (app/[slug]/page.tsx). Renders as a bell + outline pill so it
// reads as "alongside" the tabs, not as a third tab the user would try
// to click into a view.
//
// The full-card empty-state version (rendered inline by the page when a
// tab has zero listings) stays its own thing — this button is the
// always-on access point for when there ARE listings but the user wants
// alerts anyway. Patrick 2026-06-18.

import { useEffect, useState } from 'react';
import BuildingAlerts from './BuildingAlerts';
import { IconBell, IconX } from './icons';

const TEAL = '#00B2CC';
const NAVY = '#0D173B';
const BODY = "'Poppins', sans-serif";
const DISP = "'Plus Jakarta Sans', sans-serif";

type Props = {
  buildingName: string;
  buildingFilter: Record<string, any>;
  kind?: string;
  /** Default transaction the modal opens to — usually the page's defaultTab. */
  transaction?: 'sale' | 'rent';
  source?: string;
};

export default function BuildingAlertsButton({
  buildingName, buildingFilter, kind, transaction = 'sale', source,
}: Props) {
  const [open, setOpen] = useState(false);

  // Close on Escape + lock body scroll while open. Both are cheap and
  // expected of a modal — without them the page scrolls behind the
  // overlay and the user has to mouse-hunt for the close X.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // iOS-safe scroll lock. Plain `body { overflow: hidden }` does NOT lock
    // scroll on iOS Safari, and focusing the modal's email/inputs there shifts
    // the page — you return to the page with content pushed past the mobile
    // viewport (Patrick caught this on a community page, 2026-06-20). Pinning
    // the body (position:fixed + width:100% + negative top offset) locks it
    // cleanly; we restore the exact scroll position on close.
    const scrollY = window.scrollY;
    const b = document.body;
    const prev = { overflow: b.style.overflow, position: b.style.position, top: b.style.top, width: b.style.width };
    b.style.overflow = 'hidden';
    b.style.position = 'fixed';
    b.style.top = `-${scrollY}px`;
    b.style.width = '100%';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      b.style.overflow = prev.overflow;
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          // Outline pill (vs the filled For Sale/Rent tabs) so it reads as
          // a sibling action, not a third tab. Bell icon does most of the
          // semantic work.
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          borderRadius: 999,
          border: `1.5px solid ${TEAL}`,
          background: '#fff',
          color: NAVY,
          fontFamily: DISP,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.2px',
          // No marginLeft — the parent row's `gap` handles spacing, and an
          // extra 8px here pushed the pill past the card edge on a 390px
          // phone. nowrap + no-shrink keep 'Get alerts' on one line instead
          // of breaking into two and blowing out the pill's height.
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        aria-label={`Get alerts for ${buildingName}`}
      >
        <IconBell size={14} color={TEAL} />
        Get alerts
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Get alerts for ${buildingName}`}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(13, 23, 59, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, fontFamily: BODY,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16,
              width: '100%', maxWidth: 480,
              maxHeight: 'calc(100vh - 40px)',
              overflow: 'auto',
              padding: '18px 18px 22px',
              boxShadow: '0 20px 50px rgba(13,23,59,0.25)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'transparent', border: 'none',
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: NAVY,
              }}
            >
              <IconX size={18} color={NAVY} />
            </button>
            <BuildingAlerts
              buildingName={buildingName}
              buildingFilter={buildingFilter}
              kind={kind}
              transaction={transaction}
              source={source}
            />
          </div>
        </div>
      )}
    </>
  );
}
