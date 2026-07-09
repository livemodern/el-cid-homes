import '../listing.css'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getListing } from '@/lib/listing'
import { propertyDetailsFor } from '@/lib/listingDetails'
import { imgOpt, imgSrcSet } from '@/lib/img'
import CardPhotos from '@/components/CardPhotos'
import { mlsIdFromSlug, slugifyListing } from '@/lib/listing-slug'
import ListingClient from '@/components/ListingClient'
import ListingGate from '@/components/ListingGate'
import { getSiteConfig } from '@/lib/site-config'
import SaveButton from '@/components/SaveButton'
import InquireButton from '@/components/InquireButton'
import RequestShowing from '@/components/RequestShowing'
import BuildingAlerts from '@/components/BuildingAlerts'

// ISR: cache + regenerate every 60s. Server-rendered HTML drops TTFB to ~50ms
// for readers in the window; sync runs hourly so 60s staleness is invisible.
export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'
const money = (n: number | null | undefined) => (n == null ? '—' : '$' + Math.round(n).toLocaleString())

// Featured agent — hardcoded for now. This const is the single swap point;
// later an admin selector will set this per-site (or per-listing) from the
// agents table. Pulled from agents row a34fe83e (Patrick Lafferty).
const FEATURED_AGENT = {
  name: 'Patrick Lafferty',
  first: 'Patrick',
  title: 'Founding Agent',
  phone: '(561) 603-4329',
  tel: '5616034329',
  photo_url: 'https://ezcikavnfchqaenweygw.supabase.co/storage/v1/object/public/agent-photos/a34fe83e-10cd-4a3f-9f4a-a3e58e358069/headshot-1781048024794.jpg',
}

const STATUS_COLOR: Record<string, string> = {
  Active: '#16a34a', ComingSoon: '#0ea5e9', ActiveUnderContract: '#d97706',
  Pending: '#d97706', Closed: '#64748b', Withdrawn: '#64748b',
}
const statusLabel = (s: string) =>
  s === 'ActiveUnderContract' ? 'Under Contract' : s === 'ComingSoon' ? 'Coming Soon' : s

// `await (params as any)` works whether Next passes params as a plain object
// (14) or a Promise (15) — awaiting a non-thenable returns it unchanged.
export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  const { slug } = await (params as any)
  const data = await getListing(mlsIdFromSlug(decodeURIComponent(slug)))
  if (!data) return { title: 'Listing not found | El Cid Homes', robots: { index: false } }
  const { l } = data
  const unit = l.unit_number ? `Unit ${l.unit_number}` : (l.street_address || 'Home')
  const bld = l.building_name || 'El Cid'
  const isRent = l.sale_or_lease === 'Lease' || l.property_type === 'ResidentialLease'
  const title = `${unit} · ${bld}, ${money(l.list_price)}${isRent ? '/mo' : ''} | El Cid Homes`
  const desc = (l.description || `${l.beds ?? ''} bed ${l.baths ?? ''} bath residence at ${bld}, ${l.city}, FL.`)
    .replace(/\s+/g, ' ').slice(0, 180)
  const canonicalSlug = slugifyListing(l as any)
  const ogImage = l.image_urls?.[0] ? imgOpt(l.image_urls[0], 1200) : undefined
  return {
    title,
    description: desc,
    alternates: { canonical: `/listings/${canonicalSlug}` },
    openGraph: {
      title, description: desc, url: `${SITE_URL}/listings/${canonicalSlug}`,
      type: 'website', images: ogImage ? [ogImage] : [],
    },
  }
}

export default async function ListingPage({ params }: { params: any }) {
  const { slug } = await (params as any)
  const data = await getListing(mlsIdFromSlug(decodeURIComponent(slug)))
  if (!data) notFound()
  const { l, similar } = data
  const _site = await getSiteConfig().catch(() => null)
  const _reg = ((_site as any)?.config?.registration) || {}
  const gateLimit: number = typeof _reg.afterViews === 'number' ? _reg.afterViews : 2
  const gateEnabled: boolean = _reg.enabled !== false

  const isRent = l.sale_or_lease === 'Lease' || l.property_type === 'ResidentialLease'
  const photos: string[] = (l.image_urls ?? []).filter(Boolean)
  const lbImgs = photos.map((u: string) => imgOpt(u, 1920))
  const mcImgs = photos.map((u: string) => imgOpt(u, 900))
  const sqft = l.sqft || l.building_area_total || null
  const ppsf = l.list_price && sqft ? Math.round(l.list_price / sqft) : null
  const price = l.list_price ?? 0
  const hoa = l.hoa_fee ?? 0
  const unit = l.unit_number ? `Unit ${l.unit_number}` : 'Home'
  const addr = l.street_address || [l.city, l.state, l.zip].filter(Boolean).join(', ')
  const bld = l.building_name || 'El Cid'
  const lng = l.longitude ?? -80.0520, lat = l.latitude ?? 26.6918

  const _vtRaw = l.vtour_unbranded || l.vtour_branded
  const vtUrl = (typeof _vtRaw === 'string' && _vtRaw.startsWith('http')) ? _vtRaw : null

  const _det = propertyDetailsFor(l as any)
  const detail: [string, string][] = [..._det.mainFields, ..._det.moreFields]
    .map(([k, v]) => [k, k === 'Status' ? statusLabel(l.status) : String(v)] as [string, string])

  const inquireListing = {
    mls_id: l.mls_id,
    street_address: l.street_address || addr,
    city: l.city ?? undefined,
    state: l.state ?? undefined,
    list_price: l.list_price ?? undefined,
    beds: l.beds ?? undefined,
    baths: l.baths ?? undefined,
    sqft: sqft ?? undefined,
  }

  // Map Trestle subtype to schema.org accommodation type for AI search ranking.
  const accomType = ({
    Condominium: 'Apartment', SingleFamilyResidence: 'SingleFamilyResidence',
    Townhouse: 'House', Villa: 'House', Apartment: 'Apartment', ResidentialLease: 'Apartment',
  } as Record<string, string>)[l.property_subtype || ''] || 'Residence'

  const listingUrl = `${SITE_URL}/listings/${slugifyListing(l as any)}`
  const isAvailable = l.status === 'Active' || l.status === 'ComingSoon'

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        '@id': `${listingUrl}#listing`,
        url: listingUrl,
        name: `${bld} ${unit}`.trim() || addr,
        description: (l.description || '').replace(/\s+/g, ' ').slice(0, 400) || undefined,
        datePosted: l.created_at || undefined,
        dateModified: l.updated_at || undefined,
        about: { '@id': `${listingUrl}#property` },
        mainEntity: { '@id': `${listingUrl}#property` },
      },
      {
        '@type': accomType,
        '@id': `${listingUrl}#property`,
        name: `${bld} ${unit}`.trim() || addr,
        description: (l.description || '').replace(/\s+/g, ' ').slice(0, 400) || undefined,
        image: lbImgs.slice(0, 6),
        url: listingUrl,
        address: {
          '@type': 'PostalAddress',
          streetAddress: l.street_address || undefined,
          addressLocality: l.city || undefined,
          addressRegion: l.state || 'FL',
          postalCode: l.zip || undefined,
          addressCountry: 'US',
        },
        ...(l.latitude && l.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: l.latitude, longitude: l.longitude } } : {}),
        numberOfRooms: l.beds || undefined,
        numberOfBedrooms: l.beds || undefined,
        numberOfBathroomsTotal: l.baths || undefined,
        ...(sqft ? { floorSize: { '@type': 'QuantitativeValue', value: sqft, unitCode: 'FTK' } } : {}),
        ...(l.year_built ? { yearBuilt: l.year_built } : {}),
        ...(l.property_subtype ? { additionalType: l.property_subtype } : {}),
        containedInPlace: { '@type': 'Place', name: bld },
        ...(l.listing_id ? { identifier: { '@type': 'PropertyValue', propertyID: 'BeachesMLS', value: l.listing_id } } : {}),
        ...(l.list_price ? {
          offers: {
            '@type': 'Offer',
            '@id': `${listingUrl}#offer`,
            url: listingUrl,
            price: l.list_price,
            priceCurrency: 'USD',
            availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
            ...(isRent ? { businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut' } : {}),
          },
        } : {}),
        ...(hoa && !isRent ? { feesAndCommissionsSpecification: `HOA: $${Math.round(hoa).toLocaleString()}/month` } : {}),
        potentialAction: { '@type': 'ReserveAction', name: 'Request a showing', target: `${listingUrl}#showing` },
      },
    ],
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', name: bld, item: `${SITE_URL}/for-sale` },
      { '@type': 'ListItem', name: l.street_address || addr || unit },
    ].map((x, i) => ({ ...x, position: i + 1 })),
  }

  const VISIBLE = 5

  return (
    <div className="frame">
      <nav className="crumbbar">
        <a href="/">Home</a><span>›</span>
        <a href="/for-sale">{bld}</a><span>›</span>
        <b>{l.street_address || addr || unit}</b>
      </nav>

      <div className="lgal">
        {mcImgs.length > 0 && (
          <div className="mcarousel" id="mcar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img id="mcimg" src={mcImgs[0]} alt={`${bld} ${unit}`} data-action="pg-open" />
            <button className="mcnav mcprev" data-action="mc-prev" aria-label="Previous photo">&#8249;</button>
            <button className="mcnav mcnext" data-action="mc-next" aria-label="Next photo">&#8250;</button>
            <div className="mccount" id="mcc" />
          </div>
        )}
        <div className="mosaic" id="mosaic">
          {photos.map((u, i) => (
            <div key={i} className={`m${i === 0 ? ' big' : ''}`} data-action="lb-open" data-lb={i}
              {...(i >= VISIBLE ? { 'data-gmore': '1', style: { display: 'none' } } : {})}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading={i === 0 ? 'eager' : 'lazy'} src={imgOpt(u, i === 0 ? 1200 : 640)} alt={`${bld} ${unit} photo ${i + 1}`} />
            </div>
          ))}
        </div>
        {photos.length > VISIBLE && (
          <div className="galmore"><button className="more" style={{ margin: '14px 0 0' }} data-action="gal-more" data-total={photos.length}>View all {photos.length} photos</button></div>
        )}
      </div>

      <div className="lb" id="lb">
        <button className="lbx" data-action="lb-close">✕</button>
        <button className="lbn lbprev" data-action="lb-prev">‹</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="lbimg" src="" alt="" />
        <button className="lbn lbnext" data-action="lb-next">›</button>
        <div className="lbc" id="lbc" />
      </div>

      <div className="pgal" id="pgal">
        <div className="pghead">
          <button className="pgx" data-action="pg-close" aria-label="Close photo gallery">←</button>
          <span className="pgc">{photos.length} photos</span>
        </div>
        <div className="pggrid">
          {photos.map((u, i) => (
            <div key={i} className={`pgi${i % 3 === 0 ? ' wide' : ''}`} data-action="lb-open" data-lb={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading={i < 4 ? 'eager' : 'lazy'} decoding="async" src={imgOpt(u, i % 3 === 0 ? 1100 : 640)} alt={`${bld} ${unit} photo ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="titlebar">
        <div>
          <div className="pr">{money(l.list_price)}{isRent && <span style={{ fontSize: '.5em', fontWeight: 400 }}>/mo</span>}
            <span className="badge" style={{ background: STATUS_COLOR[l.status] || '#64748b' }}>{statusLabel(l.status).toUpperCase()}</span></div>
          <h1 className="ad">{l.unit_number ? `Unit ${l.unit_number} · ` : ''}{addr}</h1>
          <div className="specrow">
            <span><b>{l.beds ?? '—'}</b>beds</span><span><b>{l.baths ?? '—'}</b>baths</span>
            {sqft && <span><b>{sqft.toLocaleString()}</b>sq ft</span>}
            {ppsf && !isRent && <span><b>${ppsf.toLocaleString()}</b>/ sq ft</span>}
          </div>
        </div>
        <div className="tactions">
          <SaveButton mlsId={l.mls_id} siteSlug="el-cid-homes" />
          <InquireButton listing={inquireListing} label="Schedule a tour" />
        </div>
      </div>

      <div className="dualgrid">
        <div>
          {l.description && (
            <div className="panel listing-desc"><span className="eyebrow">THE HOME</span><h2>About this home</h2>
              <div className="body"><p className="desc">{l.description}</p></div>
              <button className="readmore" data-action="readmore" type="button">Read more</button></div>
          )}
          <div className="panel"><span className="eyebrow">THE DETAILS</span><h2>Property details</h2>
            {(() => {
              const isWide = (v: any) => String(v).length > 38
              const allFields = detail
              const shorts = allFields.filter(([, v]) => !isWide(v))
              const visible = shorts.slice(0, 18)
              const overflow = shorts.slice(18)
              const longs = allFields.filter(([, v]) => isWide(v))
              const moreCount = overflow.length + longs.length
              const renderRow = ([k, v]: [string, string], wide: boolean) => (
                <div className={'dl' + (wide ? ' wide' : '')} key={k}><span>{k}</span><b>{v}</b></div>
              )
              return (
                <>
                  <div className="dgrid">{visible.map(t => renderRow(t, false))}</div>
                  {moreCount > 0 && (
                    <details className="dl-more">
                      <summary>Show all details ({moreCount} more)</summary>
                      <div className="dgrid dl-more-grid">
                        {overflow.map(t => renderRow(t, false))}
                        {longs.map(t => renderRow(t, true))}
                      </div>
                    </details>
                  )}
                </>
              )
            })()}</div>
          <div className="panel"><span className="eyebrow">LOCATION</span><h2>Where you&apos;ll live</h2>
            <div className="lmapwrap"><div id="lmap" /></div></div>
          <div className="panel bldcard">
            <div><div className="t">{bld}</div>
              <p>Explore recent sales and every available home in {bld}, one of West Palm Beach&apos;s most sought-after historic neighborhoods.</p>
              <a href="/for-sale">Explore El Cid homes →</a></div>
          </div>
        </div>

        <div className="sticky">
          {/* Featured agent — see FEATURED_AGENT const (single swap point). */}
          <div className="agcard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FEATURED_AGENT.photo_url} alt={FEATURED_AGENT.name} />
            <div>
              <div className="fe">FEATURED AGENT</div>
              <div className="nm">{FEATURED_AGENT.name}</div>
              <div className="sp">El Cid Specialist</div>
              <div className="ti">{FEATURED_AGENT.title}</div>
              <div className="ph"><a href={`tel:${FEATURED_AGENT.tel}`}>{FEATURED_AGENT.phone}</a></div>
            </div>
          </div>

          {vtUrl && (
            <a href={vtUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', color: '#0D173B', textDecoration: 'none', border: '2px solid #00B2CC', borderRadius: 16, padding: '14px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              🎥 Take a Virtual Tour
            </a>
          )}

          {/* Request a Showing — restored from the prior TCP design */}
          <div id="showing" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #0D173B 0%, #1a2a6b 100%)', padding: '16px 20px' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Request a Showing</div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Schedule in 60 seconds · Free cancellation</div>
            </div>
            <div style={{ padding: 20 }}>
              <RequestShowing listing={l} />
            </div>
          </div>

          {/* Quick saved-search widget — scoped to El Cid */}
          <BuildingAlerts buildingName="El Cid" buildingFilter={{ community_slug: 'el-cid-west-palm-beach' }} kind="home" transaction={isRent ? 'rent' : 'sale'} />

          {!isRent && price > 0 && (
            <div className="calc">
              <h3>Monthly payment</h3>
              <label>Price</label><input id="cPrice" type="number" defaultValue={price} min={0} step={1000} />
              <label>Down payment %</label><input id="cDown" type="number" defaultValue={20} min={0} max={100} />
              <label>Interest rate %</label><input id="cRate" type="number" defaultValue={6.5} step={0.1} />
              <label>Term (years)</label><input id="cTerm" type="number" defaultValue={30} />
              <div className="out"><b id="cOut">—</b><span id="cDet" /><br /><span>Estimated monthly payment</span></div>
            </div>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="off" style={{ paddingTop: 48 }}>
          <div className="sechead"><span className="eyebrow">MORE IN {(bld || 'EL CID').toUpperCase()}</span><h2 className="sec">Similar homes</h2></div>
          <div className="tcards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {similar.map(s => (
              <a className="tcard" key={s.mls_id} href={`/listings/${s.mls_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="imgw">{s.images.length > 1
                  ? <CardPhotos urls={s.images} total={s.photoCount} alt={`${bld}${s.unit_number ? ' Unit ' + s.unit_number : ''}`} width={768} widths={[480, 768, 1100, 1320]} sizes="(max-width:560px) 92vw, (max-width:900px) 46vw, 414px" />
                  : s.image
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgOpt(s.image, 768)} srcSet={imgSrcSet(s.image, [480, 768, 1100, 1320])} sizes="(max-width:560px) 92vw, (max-width:900px) 46vw, 414px" alt={`${bld}${s.unit_number ? ' Unit ' + s.unit_number : ''}`} loading="lazy" />
                    : <div className="noimg" />}</div>
                <div className="b">
                  <div className="pr">{money(s.price)}</div>
                  {s.unit_number && <div className="ad">Unit {s.unit_number}</div>}
                  <div className="specs">
                    <span><strong>{s.beds ?? '—'}</strong> bd</span>
                    <span><strong>{s.baths ?? '—'}</strong> ba</span>
                    {s.sqft ? <span><strong>{s.sqft.toLocaleString()}</strong> sf</span> : null}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="attr" style={{ paddingTop: 26 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.mlrecloud.com/brand/bmls-logo.png" alt="BeachesMLS" />
        {l.list_office_name ? `Listing courtesy of ${l.list_office_name}${l.list_agent_email ? ` · ${l.list_agent_email}` : ''}. ` : ''}
        All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified for authenticity or accuracy and is not guaranteed. Copyright ©2026 BeachesMLS, Inc.
      </p>

      <ListingGate mlsId={l.mls_id} limit={gateLimit} enabled={gateEnabled} />
      <ListingClient mcImgs={mcImgs} lbImgs={lbImgs} lng={lng} lat={lat} price={isRent ? 0 : price} hoa={hoa} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </div>
  )
}
