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
  const cur = readPlansViewed();
  if (cur.includes(name)) return cur.length;
  cur.push(name);
  writePlansViewed(cur);
  return cur.length;
}

export function getPlanViewCount(): number {
  return readPlansViewed().length;
}
