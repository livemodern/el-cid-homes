import type { Metadata } from 'next'

// Account dashboard is per-user authed content. Index never; nothing
// useful for crawlers and exposing the route surface is a needless
// privacy risk.
export const metadata: Metadata = {
  title: 'My Account | Modern Living Group',
  robots: { index: false, follow: false },
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
