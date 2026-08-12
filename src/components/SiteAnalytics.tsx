// Site-wide analytics loader. Renders once from app/layout.tsx.
//
// STANDARDISED ACROSS THE FLEET 2026-08-12. Every MLG site gets this same
// file so adding analytics to a new mini-site is "copy this component, add
// two deps, drop <SiteAnalytics /> in the layout" — no Vercel install agent,
// no per-repo improvisation. Mirrors mlg-site's src/components/Analytics.tsx.
//
// WHY NOT THE VERCEL INSTALL AGENT: it kept failing every deploy. Its commits
// include a .eslintrc.json extending next/core-web-vitals. None of these repos
// have an ESLint config, so `next build` SKIPS linting entirely — adding one
// switches linting on for the first time and the build immediately fails on
// pre-existing violations that were always there. The analytics package was
// never the problem.
//
// NO CONFLICT WITH OUR OWN PIXEL. Verified 2026-08-12: our first-party
// tracker (lib/site-tracker.ts / pixel.js) beacons to /api/track and writes
// site_events. Vercel Analytics posts to /_vercel/insights/view and touches
// window.va. Zero shared globals, zero shared endpoints. modernlivingre.com
// has been running both simultaneously. The `as VercelAnalytics` alias below
// is ONLY to avoid a name clash with this file's own default export — it is
// not a conflict workaround.
//
// ⚠️ CODE IS HALF THE SWITCH. Web Analytics must ALSO be enabled per project
// in the Vercel dashboard (Project → Analytics → Enable). Until then
// /_vercel/insights/script.js 404s and nothing is recorded no matter what
// ships in the bundle.
//
// Everything below Vercel's own two is env-gated — nothing loads until the
// corresponding NEXT_PUBLIC_* var is set, so this is safe to deploy blind.

import Script from 'next/script'
import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function SiteAnalytics() {
  const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

  return (
    <>
      {/* Vercel-native — no IDs needed. */}
      <VercelAnalytics />
      <SpeedInsights />

      {/* Google Tag Manager — head script + noscript fallback. */}
      {GTM_ID && (
        <>
          <Script
            id="gtm"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      )}

      {/* GA4 direct — only when GTM is NOT in use. Don't set both. */}
      {GA_ID && !GTM_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script
            id="ga4"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`,
            }}
          />
        </>
      )}

      {/* Meta Pixel — independent of GTM/GA4. PageView only; conversion
          events fire from the relevant submit handlers. */}
      {META_PIXEL_ID && (
        <>
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`,
            }}
          />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  )
}
