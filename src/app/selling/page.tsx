'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { imgOpt } from '@/lib/img';
import SmsConsentDisclosure, { SMS_CONSENT_TEXT } from '@/components/SmsConsentDisclosure';

const NAVY    = '#0D173B';
const TEAL    = '#00B2CC';
const SLATE   = '#64748b';
const INK      = '#1A1A1A';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

const HERO   = 'https://images.mlrecloud.com/site/el-cid-homes/el-cid-historic-homes-west-palm-beach.jpg';
const PATRICK = 'https://ezcikavnfchqaenweygw.supabase.co/storage/v1/object/public/agent-photos/a34fe83e-10cd-4a3f-9f4a-a3e58e358069/headshot-1781048024794.jpg';

const fmt = (n: number) => '$' + n.toLocaleString('en-US');

type Sale = { address: string; price: number; date: string; role: string; beds?: number; baths?: number; sqft?: number; img: string | null };
// Real closed sales Modern Living Group represented in El Cid — list & buyer
// side — matched to our team's MLS member IDs across list/co-list/buyer/
// co-buyer slots. Public BeachesMLS sold data only; addresses + sold prices.
const SALES: Sale[] = [
  { address: "259 Barcelona Road", price: 7750000, date: "Jul 2025", role: "Represented Buyer",  beds: 4, baths: 5, sqft: 3767, img: "https://images.mlrecloud.com/pbc/1117970898/000.jpg" },
  { address: "326 Valencia Road",  price: 1450000, date: "Sep 2017", role: "Represented Buyer",  beds: 5, baths: 5, sqft: 3967, img: "https://images.mlrecloud.com/pbc/1124310852/000.jpg" },
  { address: "312 Cordova Road",   price: 940000,  date: "Feb 2017", role: "Represented Seller", beds: 3, baths: 4, sqft: 1830, img: "https://images.mlrecloud.com/pbc/1124302916/000.jpg" },
  { address: "231 Sunset Road",    price: 690000,  date: "May 2015", role: "Represented Seller", beds: 5, baths: 4, sqft: 2836, img: "https://images.mlrecloud.com/pbc/1124414211/000.jpg" },
];
const SALES_VOL = SALES.reduce((sum, x) => sum + x.price, 0);

// ── Valuation lead form → /api/leads ──
function ValuationForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', unit: '', timeframe: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'err'>('idle');
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A2P/TCPA — explicit SMS consent required when capturing a phone.
    if (form.phone && !smsConsent) {
      setError('Please check the SMS consent box if you’d like agent updates by text, or leave the phone field blank to skip.');
      return;
    }
    setError(null);
    setStatus('sending');
    const detail = [
      form.unit && `Address: ${form.unit}`,
      form.timeframe && `Timeframe: ${form.timeframe}`,
      form.message,
    ].filter(Boolean).join(' · ');
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone,
          message: detail,
          source: 'seller:el-cid-homes',
          building: 'El Cid',
          siteSlug: 'el-cid-homes',
          smsConsent,
          smsConsentText: smsConsent ? SMS_CONSENT_TEXT : null,
        }),
      });
      setStatus('done');
    } catch {
      setStatus('err');
    }
  };

  if (status === 'done') return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>✓</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Request received</div>
      <div style={{ color: SLATE, fontSize: 14, fontFamily: BODY, lineHeight: 1.6 }}>
        An El Cid specialist will be in touch within the hour with real numbers for your home.
      </div>
    </div>
  );

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 16px', border: '1px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, fontFamily: BODY, outline: 'none',
    color: '#323232', marginBottom: 12, boxSizing: 'border-box', background: '#fff',
  };

  return (
    <form onSubmit={submit}>
      <input style={inp} placeholder="Full Name *" value={form.name} onChange={set('name')} required />
      <input style={inp} placeholder="Email Address *" type="email" value={form.email} onChange={set('email')} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input style={inp} placeholder="Phone Number" type="tel" value={form.phone} onChange={set('phone')} />
        <input style={inp} placeholder="Street address" value={form.unit} onChange={set('unit')} />
      </div>
      <select style={{ ...inp, color: form.timeframe ? '#323232' : '#94a3b8', appearance: 'none' }} value={form.timeframe} onChange={set('timeframe')}>
        <option value="">When are you thinking of selling?</option>
        <option value="Just curious about value">Just curious about value</option>
        <option value="0 to 3 months">In the next 3 months</option>
        <option value="3 to 6 months">3 to 6 months</option>
        <option value="6 to 12 months">6 to 12 months</option>
        <option value="Just exploring">Just exploring</option>
      </select>
      <textarea style={{ ...inp, resize: 'none', height: 92 }}
        placeholder="Anything we should know? (renovations, updates, waterfront…)"
        value={form.message} onChange={set('message')} />
      <SmsConsentDisclosure checked={smsConsent} onChange={setSmsConsent} style={{ marginTop: 2, marginBottom: 14 }} />
      {error && <div style={{ color: '#dc2626', fontSize: 12, fontFamily: BODY, marginBottom: 10, textAlign: 'center' }}>{error}</div>}
      <button type="submit" disabled={status === 'sending'} style={{
        width: '100%', padding: '15px', background: TEAL, color: '#fff', border: 'none',
        borderRadius: 10, fontFamily: DISPLAY, fontSize: 13, fontWeight: 800,
        letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
      }}>
        {status === 'sending' ? 'Sending…' : "Get My Home's Value"}
      </button>
      {status === 'err' && <div style={{ color: '#dc2626', fontSize: 12, fontFamily: BODY, marginTop: 10, textAlign: 'center' }}>Something went wrong, please call (561) 228-8420.</div>}
    </form>
  );
}

export default function SellingPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);


  const wrap = (n?: number): React.CSSProperties => ({ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '0 18px' : '0 24px', ...(n ? { paddingTop: n, paddingBottom: n } : {}) });
  const eyebrow: React.CSSProperties = { fontSize: 12, color: TEAL, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: DISPLAY, marginBottom: 14 };

  const initialCount = isMobile ? 8 : 15;
  const visibleSales = showAll ? SALES : SALES.slice(0, initialCount);

  return (
    <div style={{ background: '#fff', fontFamily: BODY, color: INK }}>

      {/* ── HERO ── */}
      <div style={{ position: 'relative', height: isMobile ? 540 : 600, overflow: 'hidden', marginTop: '-72px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt="El Cid Historic District, West Palm Beach" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,23,59,0.55) 0%, rgba(13,23,59,0.25) 38%, rgba(13,23,59,0.82) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: isMobile ? '96px 24px 56px' : '120px 40px 80px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 16, fontFamily: DISPLAY }}>
            Sell With Modern Living Group
          </div>
          <h1 style={{ fontSize: isMobile ? 34 : 60, fontWeight: 800, color: '#fff', margin: '0 0 16px', fontFamily: DISPLAY, lineHeight: 1.04, maxWidth: 820 }}>
            The team that knows <em style={{ color: TEAL, fontStyle: 'italic' }}>El Cid</em>
          </h1>
          {!isMobile && (<p style={{ color: 'rgba(255,255,255,0.82)', fontSize: isMobile ? 14 : 18, maxWidth: 600, margin: '0 0 28px', fontFamily: BODY, lineHeight: 1.6 }}>
            We market Downtown West Palm Beach real estate for a living and know El Cid inside out. When it&rsquo;s time to sell your historic home, list with the team buyers already call.
          </p>)}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="#valuation" style={{ padding: '15px 30px', background: TEAL, color: '#fff', textDecoration: 'none', borderRadius: 99, fontFamily: DISPLAY, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Get My Home&rsquo;s Value</a>
            {!isMobile && (<a href="tel:5612288420" style={{ padding: '15px 30px', background: 'rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none', borderRadius: 99, fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(4px)' }}>(561) 228-8420</a>)}
          </div>
        </div>
      </div>

      {/* ── STAT STRIP ── */}
      <div style={{ background: NAVY }}>
        <div style={{ ...wrap(), display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 24 : 16, padding: isMobile ? '34px 18px' : '44px 24px' }}>
          {[
            { n: `${SALES.length}`, l: 'Sales we’ve represented in El Cid' },
            { n: `$${(SALES_VOL / 1e6).toFixed(1)}M`, l: 'In El Cid sales volume' },
            { n: 'List + Buyer', l: 'Both sides of the table' },
            { n: 'Since 2015', l: 'Closings in El Cid' },
          ].map((st, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: DISPLAY, fontSize: isMobile ? 26 : 38, fontWeight: 800, color: TEAL, lineHeight: 1 }}>{st.n}</div>
              <div style={{ fontSize: isMobile ? 11 : 13, color: 'rgba(255,255,255,0.72)', marginTop: 8, fontFamily: BODY, lineHeight: 1.4 }}>{st.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── INTRO ── */}
      <section style={{ ...wrap(isMobile ? 56 : 88), maxWidth: 820, textAlign: 'center' }}>
        <div style={eyebrow}>National Network · Local Touch</div>
        <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 40, fontWeight: 800, color: NAVY, margin: '0 0 22px', lineHeight: 1.12 }}>
          In the market to sell your El Cid home?
        </h2>
        <p style={{ fontSize: isMobile ? 15 : 17, color: '#3f4a5c', lineHeight: 1.75, margin: '0 0 18px', fontFamily: BODY }}>
          We market Downtown West Palm Beach real estate for a living, and El Cid is right in our backyard. Tap our team for hands-on guidance through the entire sale — pricing and staging advice, marketing, showings, and fielding offers as they roll in.
        </p>
        <p style={{ fontSize: isMobile ? 15 : 17, color: '#3f4a5c', lineHeight: 1.75, margin: 0, fontFamily: BODY }}>
          And you&rsquo;re never going in alone. Modern Living Group is backed by Compass, the #1 brokerage in America, which puts your home in front of 35,000+ of the nation&rsquo;s best agents and the relocation and second-home buyers driving this market.
        </p>
      </section>

      {/* ── VALUATION FORM ── */}
      <section id="valuation" style={{ background: '#f8fafc', borderTop: '1px solid #eef2f7', borderBottom: '1px solid #eef2f7' }}>
        <div style={{ ...wrap(isMobile ? 48 : 80), display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 440px', gap: 56, alignItems: 'center' }}>
          <div style={{ marginBottom: isMobile ? 32 : 0 }}>
            <div style={eyebrow}>Free Home Valuation</div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 42, fontWeight: 800, color: NAVY, margin: '0 0 18px', lineHeight: 1.1 }}>
              What&rsquo;s your El Cid home <em style={{ color: TEAL, fontStyle: 'italic' }}>worth?</em>
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: '#3f4a5c', lineHeight: 1.7, margin: '0 0 22px', fontFamily: BODY }}>
              Get a free, no-obligation valuation from the team that actually sells in this neighborhood — real numbers based on recent El Cid comps, your street and your home&rsquo;s character. Not an algorithm guessing from a zip code.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {['Same-day response from an El Cid specialist', 'Comps from real, recent El Cid sales', 'A pricing strategy, not just a number', 'Zero obligation, sell when (and if) you want'].map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: NAVY, fontFamily: BODY }}>
                  <span style={{ color: TEAL, fontWeight: 800, flexShrink: 0 }}>✓</span>{t}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 12px 48px rgba(13,23,59,0.10)' }}>
            <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, padding: '22px 26px' }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, color: '#fff', marginBottom: 3 }}>Request your valuation</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', fontFamily: BODY }}>We respond within 1 hour</div>
            </div>
            <div style={{ padding: '22px 26px' }}><ValuationForm /></div>
          </div>
        </div>
      </section>

      {/* ── OUR SALES ── */}
      <section style={wrap(isMobile ? 56 : 88)}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
          <div style={eyebrow}>Proof, Not Promises</div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 40, fontWeight: 800, color: NAVY, margin: '0 0 16px', lineHeight: 1.12 }}>
            Our sales in El Cid
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 16, color: '#3f4a5c', lineHeight: 1.7, margin: 0, fontFamily: BODY }}>
            A selection of closed home sales our team has represented in El Cid, list side and buyer side — real addresses and real sold prices.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
          {visibleSales.map((s, i) => {
            const sellerSide = s.role === 'Represented Seller';
            const buyerSide = s.role === 'Represented Buyer';
            const badgeBg = sellerSide ? TEAL : buyerSide ? 'rgba(13,23,59,0.92)' : '#475569';
            return (
              <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e8edf3', boxShadow: '0 4px 20px rgba(13,23,59,0.06)' }}>
                <div style={{ position: 'relative', aspectRatio: '4 / 3', background: `linear-gradient(135deg, ${NAVY}, #1a2a6b)` }}>
                  {s.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgOpt(s.img, 560, 72)} alt={`El Cid — ${s.address}, sold ${fmt(s.price)}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>El Cid</div>
                      <div style={{ fontSize: 11, fontFamily: BODY, marginTop: 4 }}>West Palm Beach</div>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12 }}>
                    <span style={{ padding: '5px 11px', borderRadius: 99, background: badgeBg, color: '#fff', fontFamily: DISPLAY, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.role}</span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 14px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 800, color: '#fff' }}>{fmt(s.price)}</div>
                  </div>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 800, color: NAVY }}>{s.address}</div>
                    {s.beds != null && <div style={{ fontSize: 12, color: SLATE, fontFamily: BODY, marginTop: 2 }}>{s.beds} bd · {s.baths} ba · {s.sqft?.toLocaleString()} sf</div>}
                  </div>
                  <div style={{ fontSize: 12, color: SLATE, fontFamily: DISPLAY, fontWeight: 600 }}>Sold {s.date}</div>
                </div>
              </div>
            );
          })}
        </div>
        {SALES.length > initialCount && (
          <div style={{ textAlign: 'center', marginTop: 34 }}>
            <button onClick={() => setShowAll(v => !v)} style={{ padding: '13px 32px', background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, borderRadius: 99, fontFamily: DISPLAY, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {showAll ? 'View fewer' : `View all ${SALES.length} sales`}
            </button>
          </div>
        )}
        <p style={{ textAlign: 'center', fontSize: 13, color: SLATE, fontFamily: BODY, marginTop: 30, lineHeight: 1.6 }}>
          From public BeachesMLS closed records and our historical transaction book. Sold prices only, no client or commission information.
        </p>
      </section>

      {/* ── WHY LIST: NATIONAL + LOCAL ── */}
      <section style={{ background: NAVY }}>
        <div style={wrap(isMobile ? 56 : 88)}>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 44px' }}>
            <div style={{ ...eyebrow, color: TEAL }}>The Power of Compass</div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 40, fontWeight: 800, color: '#fff', margin: '0 0 16px', lineHeight: 1.12 }}>
              National reach, <em style={{ color: TEAL, fontStyle: 'italic' }}>neighborhood</em> depth
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 16, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, margin: 0, fontFamily: BODY }}>
              Compass brings the engine. Modern Living Group brings everything a national brand can&rsquo;t: people who know this building, the data on every line, and buyers already in hand.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 16 : 22 }}>
            {[
              { n: '#1', h: 'The brokerage behind your sale', p: 'Compass is the #1 U.S. brokerage by sales volume five years running, $262B in homes sold in 2025, on the only contact-to-close marketing platform in the industry.' },
              { n: 'Day 1', h: 'Buyers already in hand', p: 'A working database of active downtown WPB buyers and saved-search alerts puts your home in matched inboxes the hour it hits the market.' },
              { n: 'This site', h: 'We wrote the page on this neighborhood', p: 'elcidhomes.com ranks on Google for the exact searches your buyer is typing — live El Cid pricing, recent sales and homes for sale — so they land with us.' },
              { n: 'Since 2008', h: '1,000+ closed · $600M+', p: 'Founding agent Patrick Lafferty and the team have closed over 1,000 transactions and more than $600M in sales across their careers, through every market cycle, with the negotiating reps to prove it.' },
            ].map((c, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: isMobile ? '24px 22px' : '30px 30px' }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 800, color: TEAL, marginBottom: 12 }}>{c.n}</div>
                <h3 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{c.h}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.66)', lineHeight: 1.65, margin: 0, fontFamily: BODY }}>{c.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPASS ADVANTAGE TOOLS ── */}
      <section style={wrap(isMobile ? 56 : 88)}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
          <div style={eyebrow}>The Compass Advantage</div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 38, fontWeight: 800, color: NAVY, margin: '0 0 16px', lineHeight: 1.12 }}>
            Tools that sell for more, in less time
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 16, color: '#3f4a5c', lineHeight: 1.7, margin: 0, fontFamily: BODY }}>
            Exclusive Compass programs, available to you the moment you list with our team.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 18 }}>
          {[
            { t: 'Compass Concierge', d: 'We front the cost of staging, painting and improvements that raise your sale price, repaid at closing, with no interest and no upfront fees.' },
            { t: 'Bridge Loans', d: 'Access the equity in your current home before it sells, so you can buy your next place without waiting on the sale.' },
            { t: 'Compass Coming Soon', d: 'Build demand and test the market with a Coming Soon listing before going live, early to list, early to sell.' },
            { t: 'Private Exclusives', d: 'Market your home discreetly to Compass agents and their buyers first, sell your home while keeping your privacy.' },
          ].map((c, i) => (
            <div key={i} style={{ border: '1px solid #e8edf3', borderRadius: 16, padding: '26px 24px', background: '#fbfcfe' }}>
              <div style={{ width: 38, height: 4, background: TEAL, borderRadius: 4, marginBottom: 18 }} />
              <h3 style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 800, color: NAVY, margin: '0 0 10px' }}>{c.t}</h3>
              <p style={{ fontSize: 13.5, color: '#4a5568', lineHeight: 1.65, margin: 0, fontFamily: BODY }}>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SALES PROCESS ── */}
      <section style={{ background: '#f8fafc', borderTop: '1px solid #eef2f7' }}>
        <div style={wrap(isMobile ? 56 : 88)}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 44px' }}>
            <div style={eyebrow}>The Typical Sale</div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 28 : 38, fontWeight: 800, color: NAVY, margin: '0 0 16px', lineHeight: 1.12 }}>
              How we sell your home
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 16, color: '#3f4a5c', lineHeight: 1.7, margin: 0, fontFamily: BODY }}>
              A clear, proven path from first conversation to closing day, with our team carrying the weight at every step.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 16 : 20, maxWidth: 920, margin: '0 auto' }}>
            {[
              { t: 'Home visit & strategy', d: 'We walk your home, answer every question, and discuss condition, upgrades and current El Cid inventory before settling on a number.' },
              { t: 'Pricing to win', d: 'A property gets the most traffic in its first weeks. We price to maximize buyer activity and your position in the market from day one.' },
              { t: 'Marketing your home', d: 'Professional media plus Compass pre-marketing, Private Exclusive and Coming Soon, then syndication that reaches buyers nationally and internationally.' },
              { t: 'Showings', d: 'We coordinate access and keep things flexible so no qualified buyer slips away, while keeping your privacy and schedule in mind.' },
              { t: 'Offers & negotiation', d: 'When offers come in, we help you weigh price, contingencies and terms, accept, counter or decline, to hit your specific goals.' },
              { t: 'Inspection & escrow', d: 'Deposit goes to escrow, disclosures and the contract are reviewed, and your home comes off the market while the buyer performs due diligence.' },
              { t: 'Final walk-through', d: 'Scheduled 24 to 48 hours before closing to confirm condition and that all agreed repairs are complete, so there are no closing-day surprises.' },
              { t: 'Closing', d: 'You sign over the deed, the balance is paid in full, and ownership transfers. We’re with you through the last signature.' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8edf3', borderRadius: 14, padding: isMobile ? '20px 20px' : '24px 26px', display: 'flex', gap: 16 }}>
                <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 99, background: NAVY, color: TEAL, fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                <div>
                  <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, color: NAVY, margin: '0 0 6px' }}>{s.t}</h3>
                  <p style={{ fontSize: 13.5, color: '#4a5568', lineHeight: 1.6, margin: 0, fontFamily: BODY }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ ...wrap(isMobile ? 56 : 88) }}>
        <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, borderRadius: 24, padding: isMobile ? '40px 26px' : '60px 64px', display: isMobile ? 'block' : 'flex', alignItems: 'center', gap: 48 }}>
          <div style={{ flex: 1, marginBottom: isMobile ? 28 : 0 }}>
            <h2 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 26 : 38, fontWeight: 800, color: '#fff', margin: '0 0 14px', lineHeight: 1.1 }}>
              Ready to sell in El Cid?
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(255,255,255,0.74)', lineHeight: 1.7, margin: '0 0 24px', fontFamily: BODY }}>
              Start with a free valuation, or reach Patrick directly. No pressure, just real numbers and a plan.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="#valuation" style={{ padding: '15px 30px', background: TEAL, color: '#fff', textDecoration: 'none', borderRadius: 99, fontFamily: DISPLAY, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Get My Home&rsquo;s Value</a>
              <Link href="/contact" style={{ padding: '15px 30px', background: 'rgba(255,255,255,0.20)', color: '#fff', textDecoration: 'none', borderRadius: 99, fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,255,255,0.50)' }}>Contact the Team</Link>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, display: 'flex', gap: 16, alignItems: 'center', minWidth: isMobile ? 0 : 320, boxShadow: '0 14px 44px rgba(0,0,0,0.28)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, overflow: 'hidden', flexShrink: 0, background: '#eef2f7' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PATRICK} alt="Patrick Lafferty, El Cid specialist at Modern Living Group" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: TEAL, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: DISPLAY, marginBottom: 4 }}>El Cid Specialist</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Patrick Lafferty</div>
              <a href="tel:5616034329" style={{ display: 'block', color: NAVY, fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 3 }}>📞 561.603.4329</a>
              <a href="mailto:patrick@modernlivingre.com" style={{ color: TEAL, fontFamily: BODY, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>patrick@modernlivingre.com</a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

