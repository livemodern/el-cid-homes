'use client';

import { useState, useEffect } from 'react';
import HomeFloorPlans from '@/components/HomeFloorPlans';
import { listingHref } from '@/lib/listing-slug';
import { listingImageProps, imgOpt, imgSrcSet, HERO_WIDTHS, HERO_SIZES } from '@/lib/img';

//  LiveModern brand: Teal #00B2CC · Navy #0D173B · Ink #1A1A1A
//  Content is CMS-driven (sites.config, authored in mlg-admin → Mini-Sites).

type Cfg = any;

export default function HomeContent({ cfg, avgPrice, forSaleCount, featured, gateLimit = 2, gateEnabled = true }: { cfg: Cfg; avgPrice: string; forSaleCount: number; featured: any[]; gateLimit?: number; gateEnabled?: boolean }) {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const c = cfg || {};
  const hero = c.hero || {};
  const sections = c.sections || {};
  const wt = sections.walkthrough || {};
  const loc = sections.location || {};
  const vcta = sections.valueCta || {};
  const about = sections.about || {};
  const faqs = Array.isArray(sections.faqs) ? sections.faqs : [];
  const amen = c.amenities || {};
  const team = Array.isArray(c.team) ? c.team : [];
  const floorplans = Array.isArray(c.floorplans) ? c.floorplans : [];
  const stats = Array.isArray(c.stats) ? c.stats : [];
  const ctas = Array.isArray(hero.ctas) ? hero.ctas : [];

  const heroImg = hero.image ? imgOpt(hero.image, 1280) : '';
  const title: string = hero.title || 'El Cid';
  const tw = title.split(' ');
  const tLast = tw.length > 1 ? tw.pop() : '';
  const tHead = tw.join(' ');

  return (
    <div style={{ fontFamily: "'Poppins',sans-serif", background: '#ffffff', color: '#323232' }}>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--teal:#00B2CC;--teal-d:#0095AD;--teal-l:#cce9ef;--teal-xl:#e6f7fb;--navy:#0D173B;--black1:#1A1A1A;--black2:#323232;--slate:#64748b;--border:#e2e8f0;--bg:#f8fafc}
        .sec{padding:88px 0}
        .wrap{max-width:1240px;margin:0 auto;padding:0 40px}
        .eyebrow{font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--teal);margin-bottom:10px}
        .h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(28px,3.2vw,38px);font-weight:700;line-height:1.18;letter-spacing:-.3px;color:var(--navy)}
        .h2 em{font-style:italic;font-weight:500;color:var(--teal)}
        .rule{width:72px;height:2px;background:var(--teal);border-radius:2px}
        .rule-c{width:72px;height:2px;background:var(--teal);border-radius:2px;margin:0 auto}
        .btn{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:.02em;border:none;border-radius:99px;padding:13px 28px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,color .15s ease;text-decoration:none;display:inline-block}
        .btn-teal{background:var(--teal);color:var(--navy)}
        .btn-teal:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,178,204,.34)}
        .btn-navy{background:var(--navy);color:#fff}
        .btn-ot{background:transparent;color:var(--navy);border:1.5px solid var(--navy);padding:11.5px 28px}
        .btn-ot:hover{background:var(--navy);color:#fff}
        .btn-ow{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.65);padding:11.5px 28px}
        .btn-ow:hover{background:#fff;color:var(--navy);border-color:#fff}
        .card{background:#fff;border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:all .15s}
        .card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.12)}
        .lcard{overflow:hidden}
        .statwrap{margin:-56px auto 0;position:relative;z-index:2;max-width:1140px;padding:0 24px}
        .stats{background:#fff;border-radius:14px;display:grid;grid-template-columns:repeat(4,1fr);text-align:center;padding:26px 0;box-shadow:0 14px 44px rgba(13,23,59,.10)}
        .stats > div + div{border-left:1px solid #e8eaee}
        .stats .n{font-family:'Plus Jakarta Sans',sans-serif;font-size:30px;font-weight:700;color:var(--navy);line-height:1}
        .stats .l{font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#7a7f8c;margin-top:7px;font-weight:400}
        @keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .7s ease forwards}.fu1{animation:fu .7s .12s ease forwards;opacity:0}.fu2{animation:fu .7s .24s ease forwards;opacity:0}.fu3{animation:fu .7s .36s ease forwards;opacity:0}
        .prose p{margin-bottom:18px}.prose p:last-child{margin-bottom:0}
        .prose strong{color:var(--navy);font-weight:700}
        .faq summary::-webkit-details-marker{display:none}
        .faq summary{list-style:none}
        .faq-i{transition:transform .18s ease;display:inline-block}
        .faq[open] .faq-i{transform:rotate(45deg)}
        .faq[open]{box-shadow:0 8px 24px rgba(13,23,59,.08)!important;border-color:var(--teal-l)!important}
        @media(max-width:768px){
          .wrap{padding:0 20px}.sec{padding:60px 0}
          .g2{grid-template-columns:1fr !important}
          .stats{grid-template-columns:repeat(2,1fr) !important;row-gap:18px}
          .stats > div + div{border-left:none}
          .a3{grid-template-columns:1fr !important}
          .l3{grid-template-columns:1fr !important}
          .tm2{grid-template-columns:1fr !important}
          .faband{grid-template-columns:1fr !important}
          .faimg{height:360px !important;min-height:0 !important;border-radius:22px 22px 0 0 !important}
          .facontent{padding:32px 26px !important}
          .facta{width:100% !important;justify-content:center !important}
        }
      `}</style>

      {/* HERO */}
      <section style={{ height: '72vh', position: 'relative', display: 'flex', alignItems: 'flex-end', paddingBottom: 110, overflow: 'hidden', background: 'var(--navy)' }}>
        {heroImg && (
          /* Real <img> (not a CSS background) so the browser can pick a
             viewport-sized srcset candidate and match the server preload in
             app/page.tsx (same HERO_WIDTHS/HERO_SIZES — keep them in sync). */
          <img
            src={heroImg}
            srcSet={imgSrcSet(hero.image, HERO_WIDTHS)}
            sizes={HERO_SIZES}
            alt={title}
            fetchPriority="high"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%', transform: `scale(1.04) translateY(${scrollY * .11}px)`, transition: 'transform .1s linear' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(13,23,59,0) 0%,rgba(13,23,59,0) 30%,rgba(13,23,59,0.32) 60%,rgba(13,23,59,0.58) 100%)' }} />
        <div className="wrap" style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="fu" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', color: '#bfe9f0', marginBottom: 14, textShadow: '0 1px 8px rgba(13,23,59,0.55)' }}>{hero.eyebrow || 'Downtown West Palm Beach'}</div>
            <h1 className="fu1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 'clamp(44px,6.5vw,80px)', fontWeight: 700, lineHeight: 1.02, color: '#fff', marginBottom: 22, letterSpacing: '-1px', textShadow: '0 2px 18px rgba(13,23,59,0.55), 0 1px 3px rgba(13,23,59,0.45)' }}>
              {tHead} {tLast && <em style={{ color: 'var(--teal)', fontStyle: 'italic', fontWeight: 500 }}>{tLast}</em>}
            </h1>
            {hero.subtitle && (
              <p className="fu2" style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.9, color: 'rgba(255,255,255,.88)', maxWidth: 520, margin: '0 auto 34px', textShadow: '0 1px 10px rgba(13,23,59,0.55)' }}>{hero.subtitle}</p>
            )}
            <div className="fu3" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(ctas.length ? ctas : [{ label: 'Homes For Sale', href: '/for-sale' }, { label: 'For Rent', href: '/for-rent' }]).map((cta: any, i: number) => (
                <a key={i} className={`btn ${i === 0 ? 'btn-teal' : 'btn-ow'}`} href={cta.href || '/for-sale'}>{cta.label}</a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS — a stat value may be a literal, or one of two live tokens:
          __auto__ / __avgprice__  -> the computed average price
          __forsale__              -> how many residences are on the market RIGHT NOW.
          The live count is the honest one: on a 69-home building "3" is a
          scarcity signal, and a stale hardcoded number is just wrong. */}
      {/* STATS */}
      {stats.length > 0 && (
        <div className="statwrap">
          <div className="stats">
            {stats.map((s: any, i: number) => (
              <div key={i}>
                <div className="n">{s.value === '__auto__' || s.value === '__avgprice__' ? avgPrice
                  : s.value === '__forsale__' ? String(forSaleCount)
                  : s.value}</div>
                <div className="l">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABOUT / HISTORY (SEO prose) */}
      {(about.heading || about.body) && (
        <section className="sec" style={{ background: '#fff' }}>
          <div className="wrap" style={{ maxWidth: 900 }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              {about.kicker && <div className="eyebrow">{about.kicker}</div>}
              <div className="rule-c" style={{ marginBottom: 16 }} />
              <h2 className="h2">{about.heading}</h2>
            </div>
            {about.body && (
              <div className="prose" style={{ fontSize: 14.5, lineHeight: 1.95, color: 'var(--black2)' }} dangerouslySetInnerHTML={{ __html: about.body }} />
            )}
          </div>
        </section>
      )}

      {/* WALK-THROUGH */}
      {wt.enabled !== false && (wt.heading || wt.body) && (
        <section className="sec" style={{ background: '#fff' }}>
          <div className="wrap">
            <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 68, alignItems: 'center' }}>
              <div>
                {wt.kicker && <div className="eyebrow">{wt.kicker}</div>}
                <div className="rule" style={{ marginBottom: 18 }} />
                <h2 className="h2" style={{ marginBottom: 18 }}>{wt.heading || 'Walk Through With Patrick'}</h2>
                {wt.body && <p style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--slate)', marginBottom: 28, maxWidth: 420 }}>{wt.body}</p>}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <a className="btn btn-teal" href="/contact/">Schedule a Showing</a>
                  <a className="btn btn-ot" href="/for-sale/">Homes For Sale</a>
                </div>
              </div>
              <div style={{ aspectRatio: '16/9', background: 'var(--navy)', borderRadius: 14, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {wt.image && <img src={imgOpt(wt.image, 960)} alt={`${title} walk-through`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,23,59,.30) 0%, rgba(13,23,59,.12) 38%, rgba(13,23,59,.82) 100%)' }} />
                <div style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(0,0,0,.45), 0 0 0 10px rgba(0,178,204,.16)' }}>
                  <span style={{ color: 'var(--navy)', fontSize: 24, marginLeft: 4 }}>&#9654;</span>
                </div>
                <div style={{ position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderTop: '2px solid var(--teal)', borderLeft: '2px solid var(--teal)' }} />
                <div style={{ position: 'absolute', bottom: 10, right: 10, width: 18, height: 18, borderBottom: '2px solid var(--teal)', borderRight: '2px solid var(--teal)' }} />
                <div style={{ position: 'absolute', left: 18, bottom: 16, right: 18, pointerEvents: 'none' }}>
                  <div style={{ display: 'inline-block', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--navy)', background: 'var(--teal)', padding: '4px 10px', borderRadius: 999, marginBottom: 8 }}>Coming Soon</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '.01em', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.55)' }}>{title} Walk-Thru</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FEATURED LISTINGS */}
      <section className="sec" style={{ background: 'var(--bg)' }}>
        <div className="wrap">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="eyebrow">Featured Listings</div>
            <div className="rule-c" style={{ marginBottom: 14 }} />
            <h2 className="h2">Featured {title} Listings</h2>
          </div>
          <div className="l3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
            {(featured.length > 0 ? featured : [{}, {}, {}]).map((l: any, i: number) => (
              <a key={l.mls_id || i} href={l.mls_id ? listingHref(l) : '/for-sale'} style={{ textDecoration: 'none', color: 'inherit' }} className="card lcard">
                <div style={{ height: 220, background: 'linear-gradient(135deg,var(--teal-xl) 0%,var(--teal-l) 100%)', position: 'relative', overflow: 'hidden' }}>
                  {l.image_urls?.[0]
                    ? <img {...listingImageProps(l, l.image_urls[0], 0, { width: 640, widths: [400, 640, 960] })} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--teal-d)' }}>Photo via MLS</div>}
                  {l.status && <div style={{ position: 'absolute', top: 12, left: 12, background: '#22c55e', color: '#fff', padding: '4px 11px', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Active</div>}
                </div>
                <div style={{ padding: 22 }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--navy)', marginBottom: 3 }}>{l.list_price ? '$' + l.list_price.toLocaleString() : '\u2014'}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate)', marginBottom: 14 }}>{l.unit_number ? `Unit ${l.unit_number} \u00b7 ` : ''}{l.street_address || 'El Cid, West Palm Beach'}</div>
                  <div style={{ display: 'flex', gap: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    {[{ v: l.beds, lb: 'Beds' }, { v: l.baths, lb: 'Baths' }, { v: l.sqft?.toLocaleString(), lb: 'Sq Ft' }].filter(x => x.v).map(x => (
                      <div key={x.lb}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{x.v}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)' }}>{x.lb}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '7px 22px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7 }}>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Listing provided via BeachesMLS</span>
                  <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>View &rarr;</span>
                </div>
              </a>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 44 }}>
            <a href="/for-sale" className="btn btn-teal">View All Listings</a>
          </div>
        </div>
      </section>

      {/* VALUATION / CTA BAND */}
      {vcta.enabled !== false && (vcta.heading || vcta.body) && (
        <section className="sec" style={{ background: 'var(--navy)' }}>
          <div className="wrap">
            <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 10 }}>Get Started</div>
              <div style={{ width: 72, height: 2, borderRadius: 2, background: 'var(--teal)', margin: '0 auto 18px' }} />
              <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 'clamp(26px,3.4vw,36px)', color: '#fff', marginBottom: 12, fontWeight: 700, letterSpacing: '-.3px' }}>{vcta.heading}</h2>
              {vcta.body && <p style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', lineHeight: 1.85, marginBottom: 30 }}>{vcta.body}</p>}
              <a className="btn btn-teal" href={(vcta.cta && vcta.cta.href) || '/contact'} style={{ padding: '15px 34px' }}>{(vcta.cta && vcta.cta.label) || 'Get in Touch'}</a>
            </div>
          </div>
        </section>
      )}

      {/* FLOOR PLANS (only if provided in config) */}
      {floorplans.length > 0 && (
        <section className="sec" style={{ background: '#fff' }}>
          <div className="wrap">
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div className="eyebrow">Residences</div>
              <div className="rule-c" style={{ marginBottom: 14 }} />
              <h2 className="h2">{title} Floor Plans</h2>
            </div>

            <HomeFloorPlans
              plans={floorplans}
              title={title}
              siteSlug="el-cid-homes"
              gateLimit={gateLimit}
              gateEnabled={gateEnabled}
            />
          </div>
        </section>
      )}


      {/* AMENITIES */}
      {(amen.intro || (Array.isArray(amen.groups) && amen.groups.length > 0)) && (
        <section className="sec" style={{ background: 'var(--bg)' }}>
          <div className="wrap">
            <div style={{ textAlign: 'center', marginBottom: 44, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
              <div className="eyebrow">Resort-Style Living</div>
              <div className="rule-c" style={{ marginBottom: 14 }} />
              <h2 className="h2">{title} Amenities</h2>
              {amen.intro && <p style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--slate)', marginTop: 14 }}>{amen.intro}</p>}
            </div>
            <div className="a3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
              {(amen.groups || []).map((g: any, i: number) => (
                <div key={i} className="card" style={{ padding: '26px 24px' }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 14 }}>{g.title}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {(g.items || []).map((it: string, j: number) => (
                      <li key={j} style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--black2)', padding: '6px 0', borderTop: j ? '1px solid #eef2f6' : 'none', display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--teal)', fontWeight: 700 }}>&#8226;</span>{it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LOCATION */}
      {(loc.heading || loc.body) && (
        <section className="sec" style={{ background: '#fff' }}>
          <div className="wrap">
            <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 68, alignItems: 'center' }}>
              <div>
                {loc.kicker && <div className="eyebrow">{loc.kicker}</div>}
                <div className="rule" style={{ marginBottom: 16 }} />
                <h2 className="h2" style={{ marginBottom: 22 }}>{loc.heading}</h2>
                {loc.body && <p style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--slate)' }}>{loc.body}</p>}
              </div>
              <div style={{ aspectRatio: '4/5', overflow: 'hidden', background: 'var(--teal-xl)', position: 'relative', borderRadius: 16, boxShadow: '0 14px 44px rgba(13,23,59,.12)' }}>
                {(loc.image || hero.image) && <img
                  /* 2048, not 960. This panel is a TALL portrait (546x683), but imgOpt
                     sizes by WIDTH — so a 960-wide variant of a landscape source yields
                     only ~440-640px of HEIGHT, and object-fit:cover then has to upscale
                     it 113-215% to fill 683px (1366px on a retina screen). That is the
                     blur. 2560 wide gives a 3:2 source ~1700px of height: a straight
                     downscale, zero upscale, sharp at 2x. (2048 left the 2500px-wide
                     sources 18% short, because Cloudflare never upscales past the
                     original — the height you get is width/aspect, capped at source.) Cloudflare serves AVIF so the
                     byte cost is small. */
                  src={imgOpt(loc.image || hero.image, 2560)}
                  srcSet={imgSrcSet(loc.image || hero.image, [768, 1080, 1440, 2048, 2560])}
                  sizes="(max-width: 900px) 100vw, 546px"
                  loading="lazy"
                  decoding="async"
                  alt={`${title} location`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, background: 'rgba(13,23,59,.92)', padding: '14px 18px', borderRadius: 12 }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 9.5, fontWeight: 600, color: 'var(--teal)', letterSpacing: '.18em', marginTop: 4 }}>HISTORIC DISTRICT &middot; WEST PALM BEACH, FL</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ (SEO — FAQPage JSON-LD emitted in page.tsx) */}
      {faqs.length > 0 && (
        <section className="sec" style={{ background: 'var(--bg)' }}>
          <div className="wrap" style={{ maxWidth: 860 }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div className="eyebrow">Good to Know</div>
              <div className="rule-c" style={{ marginBottom: 14 }} />
              <h2 className="h2">El Cid Homes: Frequently Asked Questions</h2>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {faqs.map((f: any, i: number) => (
                <details key={i} className="faq" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                  <summary style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--navy)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                    <span>{f.q}</span>
                    <span className="faq-i" style={{ color: 'var(--teal)', fontSize: 24, fontWeight: 400, flexShrink: 0, lineHeight: 1 }}>+</span>
                  </summary>
                  <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--slate)', marginTop: 12 }} dangerouslySetInnerHTML={{ __html: f.a }} />
                </details>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* TEAM */}
      {team.length > 0 && (
        <section className="sec" style={{ background: '#fff' }}>
          <div className="wrap">
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div className="eyebrow">Your Team</div>
              <div className="rule-c" style={{ marginBottom: 14 }} />
              <h2 className="h2">{title} Specialist{team.length > 1 ? 's' : ''}</h2>
            </div>

            {team.length === 1 ? (
              /* ── Single specialist — editorial featured band. A lone card in the
                 2-up grid floated awkwardly; this fills the width and gives the
                 building's one agent real presence: portrait, bio, and direct
                 call/email CTAs. Fully config-driven off team[0]. ── */
              <div className="faband" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 430px) 1fr', maxWidth: 1040, margin: '0 auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 18px 50px rgba(13,23,59,0.10)' }}>
                <div className="faimg" style={{ minHeight: 480, background: team[0].image ? `url(${imgOpt(team[0].image, 828)})` : 'linear-gradient(135deg,var(--navy),#1a2a5e)', backgroundSize: 'cover', backgroundPosition: 'center top' }} />
                <div className="facontent" style={{ padding: '48px 46px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 10 }}>{team[0].role}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 32, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1, marginBottom: 18 }}>{team[0].name}</div>
                  <div style={{ width: 54, height: 3, background: 'var(--teal)', borderRadius: 3, marginBottom: 22 }} />
                  {team[0].bio && <p style={{ fontSize: 15, color: '#3f4a5c', lineHeight: 1.78, margin: '0 0 30px', fontFamily: "'Poppins',sans-serif", maxWidth: 540 }}>{team[0].bio}</p>}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {team[0].phone && <a className="facta" href={`tel:${team[0].phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: 'var(--teal)', color: '#fff', textDecoration: 'none', borderRadius: 99, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: '.03em' }}>Call {team[0].phone}</a>}
                    {team[0].email && <a className="facta" href={`mailto:${team[0].email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: 'transparent', color: 'var(--navy)', textDecoration: 'none', borderRadius: 99, border: '1.5px solid var(--navy)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700 }}>Email {String(team[0].name).split(' ')[0]}</a>}
                  </div>
                </div>
              </div>
            ) : (
              /* ── 2+ specialists — the original portrait-card grid. ── */
              <div className="tm2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 22, maxWidth: 720, margin: '0 auto' }}>
                {team.map((a: any, i: number) => (
                  <div key={i} className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ height: 280, background: a.image ? `url(${imgOpt(a.image, 640)})` : 'linear-gradient(135deg,var(--navy),#1a2a5e)', backgroundSize: 'cover',
                      backgroundPosition: 'center top' }} />
                    <div style={{ padding: 22 }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>{a.name}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 14 }}>{a.role}</div>
                      {a.email && <a href={`mailto:${a.email}`} style={{ display: 'block', fontSize: 12, color: 'var(--slate)', textDecoration: 'none', marginBottom: 5 }}>{a.email}</a>}
                      {a.phone && <a href={`tel:${a.phone}`} style={{ display: 'block', fontSize: 12, color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>{a.phone}</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
