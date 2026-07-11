'use client';

// ── AuthBackGuard ─────────────────────────────────────────────────────
// Fixes the post-OAuth back-button trap (Patrick 2026-07-11, seen on
// elcidhomes.com): sign in with Google from a gated listing → land back
// on the listing → press Back → browser returns to the Google
// authorization page instead of the site page you left. The OAuth
// redirect chain leaves Google's page in browser history, and nothing on
// our side can delete another origin's history entry.
//
// The fix is a deterministic skip: we remember where the user was BEFORE
// the page they signed in from (route tracker below), the AuthModal
// stashes that as the "back target" when the Google button is clicked,
// the /auth/callback flags the landing, and this guard — armed only on
// the post-auth landing page — intercepts the FIRST Back press and
// location.replace()s to the back target. However many Google/consent
// entries polluted history, one Back lands the user exactly where they
// expect.
//
// sessionStorage keys:
//   mlg-prev-path   — rolling previous in-site path (route tracker)
//   mlg-auth-back   — back target, stashed by AuthModal at OAuth click
//   mlg-auth-landed — set by /auth/callback on a successful sign-in
//
// The guard disarms when the user navigates anywhere else (effect
// cleanup), so it can never hijack a Back press later in the session.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function AuthBackGuard() {
  const pathname = usePathname();
  const currentRef = useRef<string | null>(null);

  // Route tracker: keep the PREVIOUS in-site URL in sessionStorage so the
  // AuthModal can stash it as the back target at sign-in time.
  useEffect(() => {
    const full = pathname + (typeof window !== 'undefined' ? window.location.search : '');
    if (currentRef.current && currentRef.current !== full) {
      try { sessionStorage.setItem('mlg-prev-path', currentRef.current); } catch {}
    }
    currentRef.current = full;
  }, [pathname]);

  // Back guard: armed only on the page we land on right after auth.
  useEffect(() => {
    let landed = false;
    let back: string | null = null;
    try {
      landed = sessionStorage.getItem('mlg-auth-landed') === '1';
      back = sessionStorage.getItem('mlg-auth-back');
    } catch {}
    if (!landed || !back) return;

    try { sessionStorage.removeItem('mlg-auth-landed'); } catch {}

    // Duplicate the current entry so the first Back press pops within our
    // page (firing popstate) instead of unloading straight to Google.
    try { window.history.pushState(null, '', window.location.href); } catch { return; }

    const onPop = () => {
      let target = '/listings';
      try {
        target = sessionStorage.getItem('mlg-auth-back') || '/listings';
        sessionStorage.removeItem('mlg-auth-back');
      } catch {}
      // replace() so the Google entry we're sitting on is overwritten with
      // the page the user actually expects.
      window.location.replace(target);
    };
    window.addEventListener('popstate', onPop, { once: true });

    return () => {
      window.removeEventListener('popstate', onPop);
      // Leaving via normal navigation (not Back): consume the stale target
      // so a later sign-in can't inherit it.
      try { sessionStorage.removeItem('mlg-auth-back'); } catch {}
    };
    // Re-evaluate per pathname so the guard arms on the landing page and
    // disarms as soon as the user navigates on.
  }, [pathname]);

  return null;
}
