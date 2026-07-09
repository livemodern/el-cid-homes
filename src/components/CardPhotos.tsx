'use client'
// CardPhotos — in-card photo preview carousel for listing cards.
// Lets people peek at the first few photos (swipe on mobile, arrows on
// desktop) WITHOUT opening the listing — capped at 5 slides on purpose so
// the full gallery stays behind the click-through (registration funnel).
// The final preview slide shows a "View all N photos" pill that passes the
// tap through to the card's navigation.
//
// Perf: only the first photo loads with the card (identical payload to the
// old single <img>); navigating loads the target slide and prefetches the
// next one. Swipes never trigger the card's onClick (capture-phase guard);
// arrow taps stopPropagation + preventDefault.
import { useRef, useState } from 'react'
import { imgOpt, imgSrcSet } from '@/lib/img'

const CAP = 5

export default function CardPhotos({
  urls, total, alt, width = 640, widths = [400, 640, 828], sizes, eager = false,
}: {
  urls: string[]
  total: number
  alt: string
  width?: number
  widths?: number[]
  sizes?: string
  eager?: boolean
}) {
  const slides = urls.slice(0, CAP)
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(0) // highest slide index allowed to mount its <img>
  const touchX = useRef<number | null>(null)
  const swiped = useRef(false)

  const go = (d: number) => {
    const n = Math.min(Math.max(idx + d, 0), slides.length - 1)
    if (n === idx) return
    setIdx(n)
    setLoaded(m => Math.max(m, Math.min(n + 1, slides.length - 1)))
  }

  if (slides.length === 0) return null
  const multi = slides.length > 1

  const arrowStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 8,
    width: 30, height: 30, borderRadius: '50%', border: 0, cursor: 'pointer',
    background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 18, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    zIndex: 2,
  })

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      onClickCapture={e => {
        if (swiped.current) { e.stopPropagation(); e.preventDefault(); swiped.current = false }
      }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current == null) return
        const dx = touchX.current - e.changedTouches[0].clientX
        touchX.current = null
        if (multi && Math.abs(dx) > 40) { swiped.current = true; go(dx > 0 ? 1 : -1) }
      }}
    >
      <div style={{
        display: 'flex', height: '100%', width: '100%',
        transform: `translateX(-${idx * 100}%)`, transition: 'transform 0.28s ease',
      }}>
        {slides.map((u, i) => (
          <div key={i} style={{ flex: '0 0 100%', height: '100%', position: 'relative' }}>
            {i <= loaded && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imgOpt(u, width)}
                srcSet={i === 0 ? imgSrcSet(u, widths) : undefined}
                sizes={i === 0 ? sizes : undefined}
                alt={i === 0 ? alt : `${alt}, photo ${i + 1}`}
                loading={i === 0 && eager ? 'eager' : 'lazy'}
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
              />
            )}
          </div>
        ))}
      </div>

      {multi && idx > 0 && (
        <button
          type="button" aria-label="Previous photo" style={arrowStyle('left')}
          onClick={e => { e.stopPropagation(); e.preventDefault(); go(-1) }}
        >‹</button>
      )}
      {multi && idx < slides.length - 1 && (
        <button
          type="button" aria-label="Next photo" style={arrowStyle('right')}
          onClick={e => { e.stopPropagation(); e.preventDefault(); go(1) }}
        >›</button>
      )}

      {multi && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 5, pointerEvents: 'none', zIndex: 2,
        }}>
          {slides.map((_, i) => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === idx ? '#fff' : 'rgba(255,255,255,0.55)',
              boxShadow: '0 0 3px rgba(0,0,0,0.45)',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>
      )}

      {/* Last preview slide + more photos behind it → invite the click-through */}
      {idx === slides.length - 1 && total > slides.length && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 2,
          background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 99,
          padding: '4px 11px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          View all {total} photos →
        </div>
      )}
    </div>
  )
}
