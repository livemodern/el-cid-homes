'use client'
import { useState, CSSProperties } from 'react'
import { useUser, useIsSaved, saveListing, unsaveListing } from '@/lib/auth'
import { AuthModal } from '@/components/AuthModal'
import { IconSave } from '@/components/icons'

const BASE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 18px', borderRadius: 999, fontWeight: 600, fontSize: 14,
  cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
  border: '1.5px solid #d7dbe2', background: '#fff', color: '#0D173B', whiteSpace: 'nowrap',
}

export default function SaveButton({ mlsId, siteSlug = 'el-cid-homes' }: { mlsId: string; siteSlug?: string }) {
  const { user } = useUser()
  const { saved, setSaved } = useIsSaved(mlsId)
  const [busy, setBusy] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  const toggle = async () => {
    if (!user) { setAuthOpen(true); return }
    setBusy(true)
    try {
      if (saved) { await unsaveListing(user.id, mlsId); setSaved(false) }
      else { await saveListing(user.id, mlsId, siteSlug); setSaved(true) }
    } finally { setBusy(false) }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        style={{ ...BASE, ...(saved ? { borderColor: '#00B2CC', color: '#00B2CC' } : {}) }}
      >
        <IconSave /> {saved ? 'Saved' : 'Save'}
      </button>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        siteSlug={siteSlug}
        message="Sign in to save this residence"
      />
    </>
  )
}
