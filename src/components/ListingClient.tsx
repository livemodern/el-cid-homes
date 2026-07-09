'use client'
import { useEffect } from 'react'

// Ported from mlg-site ListingClient, trimmed for TCP: keeps the pure-client
// behaviors (mobile carousel, lightbox, Airbnb-style photo tour, read-more,
// map, mortgage calc) and drops mlg-site's analytics + showing scheduler —
// TCP uses InquireModal for contact instead.

declare global { interface Window { mapboxgl: any } }

export interface ListingClientProps {
  mcImgs: string[]
  lbImgs: string[]
  lng: number; lat: number
  price: number   // sale only; 0 hides mortgage calc
  hoa: number
}

export default function ListingClient({ mcImgs, lbImgs, lng, lat, price, hoa }: ListingClientProps) {
  useEffect(() => {
    const $ = (id: string) => document.getElementById(id)

    // ── mobile carousel ──
    let mci = 0
    const mcShow = () => {
      const img = $('mcimg') as HTMLImageElement | null
      if (!img) return
      img.src = mcImgs[mci]
      const c = $('mcc'); if (c) c.textContent = `${mci + 1} / ${mcImgs.length}`
    }
    const mcNav = (d: number) => { mci = (mci + d + mcImgs.length) % mcImgs.length; mcShow() }
    const car = $('mcar')
    let touchX: number | null = null
    const onTouchStart = (e: TouchEvent) => { touchX = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      if (touchX === null) return
      const dx = touchX - e.changedTouches[0].clientX
      if (Math.abs(dx) > 40) mcNav(dx > 0 ? 1 : -1)
      touchX = null
    }
    if (car) {
      car.addEventListener('touchstart', onTouchStart, { passive: true })
      car.addEventListener('touchend', onTouchEnd, { passive: true })
      mcShow()
    }

    // ── lightbox ──
    let lbi = 0
    // Size the lightbox image to the actual device by rewriting the Cloudflare
    // width token (e.g. width=1920 -> width=780). One correctly-sized src, NOT a
    // srcset: w-descriptor srcset mis-sizes the image when Cloudflare caps a
    // small source to its native width (descriptor claims 1080 but delivers 640,
    // so the browser lays it out tiny). The lightbox sizes by intrinsic width
    // (.lb img max-width), so a single honest src renders full-size + stays light.
    const lbW = () => Math.min(Math.round((window.innerWidth || 1280) * (window.devicePixelRatio || 1)), 1920)
    const lbSrc = (u: string, w: number) =>
      /\/cdn-cgi\/image\/[^/]*width=\d+/.test(u) ? u.replace(/width=\d+/, 'width=' + w) : u
    const lbPreload = (j: number) => { const n = lbImgs.length; if (!n) return; const k = (j + n) % n
      const pre = new Image(); pre.src = lbSrc(lbImgs[k], lbW()) }
    const lbShow = () => {
      const img = $('lbimg') as HTMLImageElement | null
      if (img) { img.removeAttribute('srcset'); img.src = lbSrc(lbImgs[lbi], lbW()) }
      const c = $('lbc'); if (c) c.textContent = `${lbi + 1} / ${lbImgs.length}`
      lbPreload(lbi + 1); lbPreload(lbi - 1)
    }
    const lbOpen = (i: number) => { lbi = i; lbShow(); $('lb')?.classList.add('open'); document.body.style.overflow = 'hidden' }
    const lbClose = () => { $('lb')?.classList.remove('open'); document.body.style.overflow = $('pgal')?.classList.contains('open') ? 'hidden' : '' }
    const lbNav = (d: number) => { lbi = (lbi + d + lbImgs.length) % lbImgs.length; lbShow() }

    const onKey = (e: KeyboardEvent) => {
      if ($('lb')?.classList.contains('open')) {
        if (e.key === 'Escape') lbClose()
        if (e.key === 'ArrowRight') lbNav(1)
        if (e.key === 'ArrowLeft') lbNav(-1)
        return
      }
      if (e.key === 'Escape' && $('pgal')?.classList.contains('open')) {
        $('pgal')?.classList.remove('open'); document.body.style.overflow = ''
      }
    }
    document.addEventListener('keydown', onKey)

    const onClick = (e: Event) => {
      const t = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
      if (t) {
        const a = t.dataset.action
        if (a === 'lb-open') lbOpen(+(t.dataset.lb || '0'))
        else if (a === 'lb-close') lbClose()
        else if (a === 'lb-next') { e.stopPropagation(); lbNav(1) }
        else if (a === 'lb-prev') { e.stopPropagation(); lbNav(-1) }
        else if (a === 'mc-next') mcNav(1)
        else if (a === 'mc-prev') mcNav(-1)
        else if (a === 'pg-open') { $('pgal')?.classList.add('open'); document.body.style.overflow = 'hidden' }
        else if (a === 'pg-close') { $('pgal')?.classList.remove('open'); document.body.style.overflow = '' }
        else if (a === 'gal-more') {
          const extras = Array.from(document.querySelectorAll('[data-gmore]')) as HTMLElement[]
          const expanded = t.dataset.expanded === '1'
          if (expanded) {
            extras.forEach(el => { el.style.display = 'none' })
            t.dataset.expanded = '0'
            const total = t.dataset.total || String(extras.length + 5)
            t.textContent = `View all ${total} photos`
            const mosaic = document.getElementById('mosaic')
            if (mosaic) { const y = mosaic.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo({ top: y, behavior: 'smooth' }) }
          } else {
            const BATCH = 6, DELAY = 220
            extras.forEach((el, i) => { setTimeout(() => { el.style.display = '' }, Math.floor(i / BATCH) * DELAY) })
            t.dataset.expanded = '1'
            t.textContent = 'Show less'
          }
        }
        else if (a === 'readmore') {
          const sec = t.closest('.listing-desc') as HTMLElement | null
          if (sec) {
            const opening = !sec.classList.contains('open')
            sec.classList.toggle('open')
            t.textContent = opening ? 'Show less' : 'Read more'
            if (!opening) { const y = sec.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo({ top: y, behavior: 'smooth' }) }
          }
        }
        return
      }
      if ((e.target as HTMLElement).id === 'lb') lbClose()
    }
    document.addEventListener('click', onClick)

    // ── auto-hide Read more when description already fits ──
    const checkDescFit = () => {
      document.querySelectorAll('.listing-desc').forEach(sec => {
        const body = sec.querySelector('.body') as HTMLElement | null
        if (!body) return
        const wasOpen = sec.classList.contains('open')
        sec.classList.remove('open', 'fits')
        if (body.scrollHeight <= body.clientHeight + 24) sec.classList.add('fits')
        if (wasOpen) sec.classList.add('open')
      })
    }
    checkDescFit()
    window.addEventListener('resize', checkDescFit)
    const fitTimer = setTimeout(checkDescFit, 200)

    // ── map ──
    const initMap = () => {
      const mb = window.mapboxgl; const el = $('lmap')
      if (!mb || !el || (el as HTMLElement).dataset.init) return
      ;(el as HTMLElement).dataset.init = '1'
      mb.accessToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
      const map = new mb.Map({ container: 'lmap', style: 'mapbox://styles/mapbox/light-v11', center: [lng, lat], zoom: 14.6, scrollZoom: false, attributionControl: false })
      map.addControl(new mb.NavigationControl({ showCompass: false }), 'top-right')
      map.on('style.load', () => { try { map.setPaintProperty('water', 'fill-color', '#c6e9ee') } catch {} })
      const pin = document.createElement('div')
      pin.style.cssText = 'width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#00B2CC;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)'
      new mb.Marker({ element: pin, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map)
    }
    if (window.mapboxgl) initMap()
    else {
      if (!document.getElementById('mapbox-gl-css')) {
        const lk = document.createElement('link'); lk.id = 'mapbox-gl-css'; lk.rel = 'stylesheet'
        lk.href = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css'; document.head.appendChild(lk)
      }
      const sc = document.createElement('script'); sc.src = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js'; sc.onload = initMap; document.body.appendChild(sc)
    }

    // ── mortgage calc (sale only) ──
    const calc = () => {
      if (!price) return
      const pIn = $('cPrice') as HTMLInputElement | null
      const p = pIn ? (+pIn.value || price) : price
      const dp = +(($('cDown') as HTMLInputElement).value) / 100
      const r = +(($('cRate') as HTMLInputElement).value) / 100 / 12
      const n = +(($('cTerm') as HTMLInputElement).value) * 12
      const loan = p * (1 - dp)
      const m = r > 0 ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n
      const tax = p * 0.011 / 12
      const out = $('cOut'); if (out) out.textContent = '$' + Math.round(m + hoa + tax).toLocaleString()
      const det = $('cDet'); if (det) det.textContent = `P&I $${Math.round(m).toLocaleString()} · HOA $${Math.round(hoa).toLocaleString()} · Est. taxes $${Math.round(tax).toLocaleString()}`
    }
    ;['cPrice', 'cDown', 'cRate', 'cTerm'].forEach(id => $(id)?.addEventListener('input', calc))
    calc()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
      window.removeEventListener('resize', checkDescFit)
      clearTimeout(fitTimer)
      car?.removeEventListener('touchstart', onTouchStart)
      car?.removeEventListener('touchend', onTouchEnd)
    }
  }, [mcImgs, lbImgs, lng, lat, price, hoa])

  return null
}

// mapbox token build marker: re-inline NEXT_PUBLIC_MAPBOX_TOKEN (20260704-144921)
