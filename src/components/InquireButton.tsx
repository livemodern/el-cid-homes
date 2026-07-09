'use client'
import { useState, CSSProperties } from 'react'
import { InquireModal } from '@/components/InquireModal'

const BASE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 18px', borderRadius: 999, fontWeight: 600, fontSize: 14,
  cursor: 'pointer', fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap',
  border: '1.5px solid #00B2CC', background: '#00B2CC', color: '#fff',
}

type InquireListing = {
  mls_id: string; street_address: string; city?: string; state?: string
  list_price?: number; beds?: number; baths?: number; sqft?: number
}

export default function InquireButton({
  listing, label, style, variant = 'primary', siteSlug = 'el-cid-homes',
}: {
  listing: InquireListing
  label: string
  style?: CSSProperties
  variant?: 'primary' | 'outline'
  siteSlug?: string
}) {
  const [open, setOpen] = useState(false)
  const vs: CSSProperties = variant === 'outline' ? { background: '#fff', color: '#0D173B' } : {}
  return (
    <>
      <button type="button" style={{ ...BASE, ...vs, ...style }} onClick={() => setOpen(true)}>{label}</button>
      <InquireModal open={open} onClose={() => setOpen(false)} listing={listing} siteSlug={siteSlug} />
    </>
  )
}
