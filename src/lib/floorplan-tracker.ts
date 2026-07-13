// ─── Floor-plan view tracker ──────────────────────────────────────────
// Mirrors lib/view-tracker.ts, but for floor plans.
//
// Why this exists as a MODULE and not as component state:
//
// The homepage shows floor plans, and so does /floorplans. Patrick's
// requirement is that opening a plan anywhere counts toward the SAME
// registration gate — "those should also be gated and record towards making
// user register". A useRef/useState counter inside one component resets on
// navigation, so a visitor could open two plans on the homepage, two more on
// /floorplans, and never hit the wall. localStorage is the only place the count
// survives the route change.
//
// Distinct plans only: reopening one you already looked at is free, so the gate
// never punishes someone for closing a modal by accident.

'use client';

const STORAGE_KEY = 'mlg.viewed_floorplans';

// The two surfaces name the same plan differently, and if we stored those names
// raw the "shared" gate would quietly stop being shared.
//
//   homepage      keys off config `label`        -> "A"
//   /floorplans   maps it to `Unit ${p.label}`   -> "Unit A"
//
// Left alone, opening plan A on the homepage and again on /floorplans records
// TWO entries for ONE plan — so the visitor burns two slots for a single plan.
// It fails toward gating too early rather than too late, which is why it would
// never have shown up as a bug report; it would just quietly annoy people.
//
// Normalising here (rather than at either call site) means the two pages cannot
// drift apart again, and a new site with its own naming transform still lands on
// the same key.
function planKey(name: string): string {
  return String(name).trim().replace(/^unit\s+/i, '').toLowerCase();
}

export function readPlansViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writePlansViewed(names: string[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(names)); } catch { /* private mode */ }
}

/** Record a plan view. Returns the number of DISTINCT plans seen so far. */
export function recordPlanView(name: string): number {
  const key = planKey(name);
  if (!key) return getPlanViewCount();
  const cur = readPlansViewed();
  if (cur.includes(key)) return cur.length;
  cur.push(key);
  writePlansViewed(cur);
  return cur.length;
}

export function getPlanViewCount(): number {
  return readPlansViewed().length;
}
