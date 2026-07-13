'use client';

import { useState, useEffect } from 'react';
import { listingHref } from '@/lib/listing-slug';
import { imgOpt, listingImageAlt } from '@/lib/img';
import CardPhotos from '@/components/CardPhotos';
const TEAL='#00B2CC',NAVY='#0D173B',SLATE='#64748b';
const STATUS_COLORS: Record<string,string>={Active:'#22c55e',Pending:'#f59e0b',Closed:'#6b7280'};
const DISPLAY="'Plus Jakarta Sans',sans-serif",BODY="'Poppins',sans-serif";
function fmt(n:number|null){return n?'$'+n.toLocaleString():'N/A';}
import BuildingAlerts from './BuildingAlerts';
import BuildingAlertsButton from './BuildingAlertsButton';
import { BUILDING_NAME, ALERT_FILTER, ALERT_KIND, ALERT_SOURCE } from '@/lib/building';

// Listings now arrive server-rendered via props (SSR) — same markup as before,
// the client just handles filter/sort/mobile interactivity over the SSR set.
export default function ForSaleGrid({ initialListings, initialError }: { initialListings:any[]; initialError?:string|null }){
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const listings = initialListings;
  const err = initialError ?? null;
  const [sf,setSf]=useState<'Active'|'Pending'|'Closed'|'All'>('Active');
  const [sort,setSort]=useState('dom_asc');
  const [minBeds,setMinBeds]=useState(0);

  // Restore filter state from sessionStorage on mount
  useEffect(()=>{
    try {
      const saved = sessionStorage.getItem('mlg_forsale_state');
      if(saved){ const s=JSON.parse(saved); if(s.sf)setSf(s.sf); if(s.sort)setSort(s.sort); if(s.minBeds!=null)setMinBeds(s.minBeds); }
    } catch{}
  },[]);

  // Persist filter state whenever it changes
  useEffect(()=>{
    try { sessionStorage.setItem('mlg_forsale_state', JSON.stringify({sf,sort,minBeds})); } catch{}
  },[sf,sort,minBeds]);

  const counts={All:listings.length,Active:listings.filter(l=>l.status==='Active').length,Pending:listings.filter(l=>l.status==='Pending').length,Closed:listings.filter(l=>l.status==='Closed').length};
  let filtered=sf==='All'?listings:listings.filter(l=>l.status===sf);
  if(minBeds>0)filtered=filtered.filter(l=>(l.beds||0)>=minBeds);
  filtered=[...filtered].sort((a,b)=>sort==='price_asc'?(a.list_price||0)-(b.list_price||0):sort==='dom_asc'?(a.days_on_market||999)-(b.days_on_market||999):(b.list_price||0)-(a.list_price||0));
  return(
    <div style={{background:'#f8fafc',minHeight:'100vh',fontFamily:BODY}}>
            {/* Hero */}
      <div style={{ position:'relative', height:isMobile?380:480, overflow:'hidden', marginTop:'-72px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.mlrecloud.com/site/el-cid-homes/el-cid-historic-homes-west-palm-beach.jpg" alt="El Cid homes for sale in West Palm Beach, Florida" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 35%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(13,23,59,0.45) 0%, rgba(13,23,59,0.2) 40%, rgba(13,23,59,0.7) 100%)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:isMobile?'0 24px 40px':'0 40px 60px', textAlign:'center' }}>
          <div style={{ fontSize:14, color:'#fff', fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:14, fontFamily:DISPLAY }}>
            El Cid · West Palm Beach
          </div>
          <h1 style={{ fontSize:isMobile?32:52, fontWeight:800, color:'#fff', margin:'0 0 12px', fontFamily:DISPLAY, lineHeight:1.05 }}>
            Homes For Sale
          </h1>
          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:isMobile?13:16, maxWidth:520, margin:0, fontFamily:BODY, lineHeight:1.65 }}>
            Active homes for sale in El Cid, West Palm Beach · Updated daily from BeachesMLS
          </p>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'0 24px'}}>
        <div style={{background:'#fff',borderRadius:16,padding:'20px 24px',margin:'24px 0',border:'1px solid #e2e8f0',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',boxShadow:'0 2px 12px rgba(0,0,0,0.05)'}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {(['Active','Pending','Closed','All'] as const).map(s=>(
              <button key={s} onClick={()=>setSf(s)} style={{padding:'8px 18px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:DISPLAY,fontSize:13,fontWeight:600,background:sf===s?TEAL:'#f1f5f9',color:sf===s?'#fff':SLATE}}>
                {s} ({counts[s]})
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid #e2e8f0',fontFamily:BODY,fontSize:13,color:NAVY,outline:'none'}}>
              <option value="price_desc">Price: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="dom_asc">Days on Market</option>
            </select>
            <select value={minBeds} onChange={e=>setMinBeds(Number(e.target.value))} style={{padding:'8px 12px',borderRadius:8,border:'1px solid #e2e8f0',fontFamily:BODY,fontSize:13,color:NAVY,outline:'none'}}>
              <option value={0}>Any Beds</option>
              <option value={1}>1+ Beds</option>
              <option value={2}>2+ Beds</option>
              <option value={3}>3+ Beds</option>
            </select>
            {/* Always-on alerts trigger. Hidden when the grid is empty — the
                emptyState card below already carries the same affordance. */}
            {filtered.length > 0 && (
              <BuildingAlertsButton
                buildingName={BUILDING_NAME} buildingFilter={ALERT_FILTER}
                kind={ALERT_KIND} transaction="sale" source={ALERT_SOURCE}
              />
            )}
          </div>
        </div>
        <div style={{marginBottom:16,fontSize:13,color:err?'#dc2626':SLATE,fontFamily:BODY}}>{err?`Unable to load listings, please refresh. (${err})`:`${filtered.length} listing${filtered.length!==1?'s':''} found`}</div>
        {/* Zero listings used to be a dead end: "0 listings found" over an
            empty grid. The visitor who searched for a condo here and found none
            is the most valuable person on the page — give them a real saved
            search instead of nothing. Same card the main site drops into an
            empty community grid. */}
        {!err && filtered.length === 0 && (
          <div style={{marginBottom:60}}>
            <BuildingAlerts
              buildingName={BUILDING_NAME} buildingFilter={ALERT_FILTER}
              kind={ALERT_KIND} transaction="sale" source={ALERT_SOURCE} emptyState
            />
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:24,marginBottom:60}}>
          {filtered.map(l=>(
            <a key={l.mls_id} href={listingHref(l)} onClick={()=>{try{sessionStorage.setItem('mlg_forsale_state',JSON.stringify({sf,sort,minBeds}));}catch{}}}
              style={{display:'block',textDecoration:'none',color:'inherit',background:'#fff',borderRadius:16,overflow:'hidden',border:'1px solid #e2e8f0',cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',transition:'all 0.15s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-4px)';(e.currentTarget as HTMLElement).style.boxShadow='0 12px 32px rgba(0,0,0,0.12)';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='';(e.currentTarget as HTMLElement).style.boxShadow='0 1px 4px rgba(0,0,0,0.06)';}}>
              <div style={{position:'relative',height:220,background:'#e2e8f0',overflow:'hidden'}}>
                {l.image_urls?.[0]?<CardPhotos urls={l.image_urls} total={(l as any).photos_total ?? l.image_urls.length} alt={listingImageAlt(l, 0)} width={640} widths={[400, 640, 960]}/>:<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:40}}>🏙️</div>}
                <span style={{position:'absolute',top:12,left:12,background:(l.days_on_market != null && l.days_on_market <= 10) ? '#00B2CC' : STATUS_COLORS[l.status]||'#94a3b8',color:'#fff',padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:700,textTransform:'uppercase',fontFamily:DISPLAY}}>{l.days_on_market != null && l.days_on_market <= 10 ? 'New' : l.status}</span>

              </div>
              <div style={{padding:'16px 20px 18px'}}>
                <div style={{fontSize:22,fontWeight:800,color:NAVY,marginBottom:4,fontFamily:DISPLAY}}>{fmt(l.list_price)}</div>
                <div style={{fontSize:13,color:SLATE,marginBottom:12,fontFamily:BODY}}>{l.street_address || 'El Cid, West Palm Beach'}</div>
                <div style={{display:'flex',gap:16,fontSize:13,color:'#475569',fontFamily:BODY}}>
                  {l.beds&&<span><strong>{l.beds}</strong> bd</span>}
                  {l.baths&&<span><strong>{l.baths}</strong> ba</span>}
                  {l.sqft&&<span><strong>{l.sqft.toLocaleString()}</strong> sqft</span>}
                </div>
                {l.hoa_fee&&<div style={{marginTop:6,fontSize:12,color:'#94a3b8',fontFamily:BODY}}>HOA: ${l.hoa_fee.toLocaleString()}/mo</div>}
                {l.days_on_market!=null&&l.days_on_market>7&&l.status==='Active'&&<div style={{fontSize:12,color:'#94a3b8',fontFamily:BODY}}>{l.days_on_market} days on market</div>}
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:10,color:'#94a3b8',fontFamily:BODY}}>MLS# {l.listing_id}</span>
                  <span style={{fontSize:11,color:TEAL,fontWeight:600,fontFamily:DISPLAY}}>View Details →</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* BeachesMLS compliance + bottom spacing */}
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 40, paddingTop: 24, paddingBottom: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/beachesmls.webp" alt="BeachesMLS" style={{ width: 130, height: 'auto', flexShrink: 0 }} />
            <p style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'Poppins, sans-serif', lineHeight: 1.6, margin: 0, flex: 1 }}>
              All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified for authenticity or accuracy and is not guaranteed. Copyright ©2026 BeachesMLS, Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

