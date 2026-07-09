import Script from 'next/script'
import FubPixelRouter from './FubPixelRouter'

// ─── Follow Up Boss Widget Tracker ────────────────────────────────────
// Mirror of mlg-site/src/components/FubPixel.tsx (commit bc06a37, the
// split-shell pattern that ships cleanly to production — earlier
// single-client-file version was tree-shaken out of the build despite
// being imported correctly).
//
// Server component renders the env-gated init <Script>; the tiny
// client FubPixelRouter handles SPA route-change pageview firing so
// listing → listing navigations land on the contact's FUB timeline.
//
// Same NEXT_PUBLIC_FUB_TRACKER_ID env var used on mlg-site — the WT-
// account is global to all MLG sites in FUB Pixel admin (Patrick has
// elcidhomes.com listed there already), so reusing the
// mlg-site tracker ID is correct. If TCP ever wants its own segmented
// reporting, mint a new WT- ID in FUB and set that as TCP's env var.
//
// Form-capture toggle in FUB Pixel admin stays OFF — TCP's /api/leads
// already creates the contact via FUB's API, so client-side capture
// would duplicate leads (same as mlg-site).

export default function FubPixel() {
  const TRACKER_ID = process.env.NEXT_PUBLIC_FUB_TRACKER_ID
  if (!TRACKER_ID) return null
  return (
    <>
      <Script
        id="fub-widget-tracker"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,i,d,g,e,t){w["WidgetTrackerObject"]=g;(w[g]=w[g]||function()
{(w[g].q=w[g].q||[]).push(arguments);}),(w[g].ds=1*new Date());(e="script"),
(t=d.createElement(e)),(e=d.getElementsByTagName(e)[0]);t.async=1;t.src=i;
e.parentNode.insertBefore(t,e);})
(window,"https://widgetbe.com/agent",document,"widgetTracker");
window.widgetTracker("create", "${TRACKER_ID}");
window.widgetTracker("send", "pageview");`,
        }}
      />
      <FubPixelRouter />
    </>
  )
}
