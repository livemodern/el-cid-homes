'use client';
import { useState, useEffect } from 'react';
import SmsConsentDisclosure from '@/components/SmsConsentDisclosure';

const NAVY    = '#0D173B';
const TEAL    = '#00B2CC';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

const PATRICK = 'https://ezcikavnfchqaenweygw.supabase.co/storage/v1/object/public/agent-photos/a34fe83e-10cd-4a3f-9f4a-a3e58e358069/headshot-1781048024794.jpg';

function ContactForm({ type }: { type: 'buy' | 'sell' }) {
  const [form, setForm]     = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'err'>('idle');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: type === 'buy' ? 'Contact - Buyer' : 'Contact - Seller', building: 'El Cid', siteSlug: 'el-cid-homes' }),
      });
      setStatus('done');
    } catch {
      setStatus('err');
    }
  };

  if (status === 'done') return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Message Sent!</div>
      <div style={{ color: SLATE, fontSize: 14, fontFamily: BODY }}>We'll be in touch within 1 hour.</div>
    </div>
  );

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 13, fontFamily: BODY, outline: 'none',
    color: '#323232', marginBottom: 12, boxSizing: 'border-box',
  };

  return (
    <form onSubmit={submit}>
      <input style={inp} placeholder="Full Name *" value={form.name} onChange={set('name')} required />
      <input style={inp} placeholder="Email Address *" type="email" value={form.email} onChange={set('email')} required />
      <input style={inp} placeholder="Phone Number" type="tel" value={form.phone} onChange={set('phone')} />
      <textarea style={{ ...inp, resize: 'none', height: 100 }}
        placeholder={type === 'buy' ? 'What are you looking for? (beds, budget, timeline…)' : 'Tell us about your home (address, timeline, questions…)'}
        value={form.message} onChange={set('message')} />
      {/* Twilio A2P consent disclosure — required when the form collects
          a phone number. Must match the disclosure quoted in the A2P
          campaign message_flow text verbatim. */}
      <SmsConsentDisclosure style={{ textAlign: 'center', marginTop: 4, marginBottom: 14 }} />
      <button type="submit" disabled={status === 'sending'} style={{
        width: '100%', padding: '14px', background: TEAL, color: '#fff', border: 'none',
        borderRadius: 8, fontFamily: DISPLAY, fontSize: 13, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
      }}>
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}

export default function ContactPage() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');

  const tabBtn = (t: 'buy' | 'sell', label: string) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, padding: '12px', border: 'none', borderRadius: 8, cursor: 'pointer',
      fontFamily: DISPLAY, fontSize: 13, fontWeight: 700,
      background: tab === t ? TEAL : '#f1f5f9',
      color: tab === t ? '#fff' : SLATE,
      transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: BODY }}>

      {/* Hero */}
      <div style={{ position:'relative', height:isMobile?340:420, overflow:'hidden', marginTop:'-72px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.mlrecloud.com/site/el-cid-homes/hero.jpg" alt="El Cid at West Palm Beach" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 35%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(13,23,59,0.45) 0%, rgba(13,23,59,0.2) 40%, rgba(13,23,59,0.7) 100%)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:isMobile?'0 24px 40px':'0 40px 60px', textAlign:'center' }}>
          <div style={{ fontSize:14, color:'#fff', fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:14, fontFamily:DISPLAY }}>
            Modern Living Group · El Cid
          </div>
          <h1 style={{ fontSize:isMobile?32:52, fontWeight:800, color:'#fff', margin:'0 0 12px', fontFamily:DISPLAY, lineHeight:1.05 }}>
            Get in Touch
          </h1>
          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:isMobile?13:16, maxWidth:460, margin:0, fontFamily:BODY, lineHeight:1.65 }}>
            We respond within 1 hour · Same-day showings available
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '28px 16px 60px' : '60px 24px 80px' }}>

        {/* ── Mobile: form first, then agents ── Desktop: side by side ── */}
        <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 400px', gap: 52, alignItems: 'start' }}>

          {/* Contact form — shows first on mobile */}
          <div style={{ order: isMobile ? -1 : 1, marginBottom: isMobile ? 36 : 0 }}>
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', position: isMobile ? 'static' : 'sticky', top: 88 }}>
              <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, padding: '20px 24px' }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Send Us a Message</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: BODY }}>We respond within 1 hour</div>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {tabBtn('buy', "I'm Buying")}
                  {tabBtn('sell', "I'm Selling")}
                </div>
                <ContactForm key={tab} type={tab} />
              </div>
            </div>
          </div>

          {/* Agent cards — left on desktop, below form on mobile */}
          <div style={{ order: isMobile ? 1 : 0 }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: isMobile ? 28 : 36, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              Your El Cid Specialist
            </h2>
            <p style={{ color: SLATE, fontSize: 13, margin: '0 0 28px', lineHeight: 1.7, fontFamily: BODY }}>
              Specializing in El Cid and Downtown West Palm Beach since 2008. We know the streets, the architecture, and every nuance of this historic neighborhood.
            </p>

            {/* Patrick card */}
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ width: isMobile ? 90 : 120, flexShrink: 0, background: '#e2e8f0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={PATRICK} alt="Patrick Lafferty, El Cid specialist at Modern Living Group" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
              </div>
              <div style={{ padding: isMobile ? '14px 16px' : '20px 24px', minWidth: 0 }}>
                <div style={{ fontSize: 10, color: TEAL, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, fontFamily: DISPLAY }}>
                  El Cid Specialist
                </div>
                <div style={{ fontFamily: DISPLAY, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: NAVY, marginBottom: 3 }}>Patrick Lafferty</div>
                <div style={{ fontSize: 12, color: SLATE, fontFamily: BODY, marginBottom: 12, lineHeight: 1.5 }}>
                  Founding Agent · 18-year Downtown West Palm Beach specialist · Modern Living Group at Compass
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="tel:5616034329" style={{ padding: '8px 14px', background: NAVY, color: '#fff', textDecoration: 'none', borderRadius: 8, fontFamily: DISPLAY, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>📞 561.603.4329</a>
                  <a href="mailto:patrick@modernlivingre.com" style={{ padding: '8px 14px', background: '#f1f5f9', color: NAVY, textDecoration: 'none', borderRadius: 8, fontFamily: DISPLAY, fontSize: 11, fontWeight: 700 }}>✉ Email</a>
                </div>
              </div>
            </div>


            {/* Office info */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px' }}>
              <div style={{ fontSize: 10, color: TEAL, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14, fontFamily: DISPLAY }}>Office Locations</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 16 : 24 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: DISPLAY, marginBottom: 4 }}>West Palm Beach</div>
                  <div style={{ fontSize: 12, color: SLATE, lineHeight: 1.8, fontFamily: BODY }}>480 Hibiscus St #110<br />West Palm Beach, FL 33401</div>
                  <a href="tel:5612288420" style={{ fontSize: 12, color: TEAL, textDecoration: 'none', fontWeight: 600, display: 'block', marginTop: 4 }}>561.228.8420</a>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: DISPLAY, marginBottom: 4 }}>Palm Beach</div>
                  <div style={{ fontSize: 12, color: SLATE, lineHeight: 1.8, fontFamily: BODY }}>150 Worth Ave #232<br />Palm Beach, FL 33480</div>
                  <a href="mailto:info@modernlivingre.com" style={{ fontSize: 12, color: TEAL, textDecoration: 'none', fontWeight: 600, display: 'block', marginTop: 4 }}>info@modernlivingre.com</a>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
