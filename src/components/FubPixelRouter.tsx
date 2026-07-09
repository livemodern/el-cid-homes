'use client'

// SPA route-change pageview firing for the FUB Widget Tracker. Mirror
// of mlg-site/src/components/FubPixelRouter.tsx — keep in parity.
// Mounted from FubPixel (the server component). Kept tiny + isolated
// because usePathname forces dynamic rendering, so limiting the
// blast radius matters.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function FubPixelRouter() {
  const pathname = usePathname()
  useEffect(() => {
    const w = window as unknown as { widgetTracker?: (...args: unknown[]) => void }
    if (typeof w.widgetTracker !== 'function') return
    try {
      w.widgetTracker('send', 'pageview')
    } catch { /* never throw from analytics */ }
  }, [pathname])
  return null
}
