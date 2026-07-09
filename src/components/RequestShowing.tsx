'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useUser, getSupabase } from '@/lib/auth'

// Restored from the prior TCP listing page: the inline showing-request widget
// (in-person/video toggle, 7-day picker, time grid, profile-prefilled form,
// posts to /api/leads). Lifted into its own client component so the rebuilt
// SSR page can drop it straight into the sticky sidebar.

const BODY = "'Poppins', sans-serif"
const DISPLAY = "'Plus Jakarta Sans', sans-serif"
const NAVY = '#0D173B'
const SLATE = '#64748b'
const TEAL = '#00B2CC'

export default function RequestShowing({ listing }: { listing: any }) {
  const { user } = useUser()
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })
  const [selectedDay, setSelectedDay] = useState(0)
  const [selectedTime, setSelectedTime] = useState('')
  const [type, setType] = useState<'in-person' | 'video'>('in-person')
  const [step, setStep] = useState<'pick' | 'form' | 'done'>('pick')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [profileLoaded, setProfileLoaded] = useState(false)

  const times = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  useEffect(() => {
    if (!user) return
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token
      if (!token) return
      fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(({ profile }) => {
          if (profile) {
            setForm(f => ({
              ...f,
              firstName: profile.firstName || f.firstName,
              lastName: profile.lastName || f.lastName,
              email: profile.email || f.email,
              phone: profile.phone || f.phone,
            }))
            setProfileLoaded(true)
          }
        }).catch(() => {})
    })
  }, [user?.id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          source: 'Request Showing',
          showingType: type,
          showingDate: days[selectedDay].toLocaleDateString(),
          showingTime: selectedTime,
          listing: listing?.street_address,
          mls_id: listing?.mls_id,
          listPrice: listing?.list_price,
          siteSlug: 'el-cid-homes',
        }),
      })
      setStep('done')
    } catch {
      setStep('done')
    }
  }

  if (step === 'done') return (
    <div style={{ textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Request Received!</div>
      <div style={{ fontFamily: BODY, fontSize: 13, color: SLATE }}>We&apos;ll confirm your showing within 1 hour.</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {(['in-person', 'video'] as const).map(t => (
          <button
            key={t} onClick={() => setType(t)} type="button"
            style={{
              flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: DISPLAY, fontSize: 13, fontWeight: 600,
              background: type === t ? '#fff' : 'transparent',
              color: type === t ? NAVY : SLATE,
              boxShadow: type === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t === 'in-person' ? '🏠 In-Person' : '📹 Video Tour'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontFamily: BODY, fontSize: 12, color: SLATE, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Select Date
        </div>
        <div style={{ fontFamily: BODY, fontSize: 11, color: '#94a3b8' }}>
          {monthNames[days[selectedDay].getMonth()]} {days[selectedDay].getFullYear()}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        {days.map((d, i) => (
          <button
            key={i} type="button"
            onClick={() => { setSelectedDay(i); setSelectedTime('') }}
            style={{
              flex: 1, minWidth: 0, padding: '8px 2px', borderRadius: 9,
              border: '2px solid', borderColor: selectedDay === i ? TEAL : '#e2e8f0',
              background: selectedDay === i ? TEAL : '#fff',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 9, color: selectedDay === i ? 'rgba(255,255,255,0.85)' : '#94a3b8', fontFamily: BODY, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
              {i === 0 ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: selectedDay === i ? '#fff' : NAVY, fontFamily: DISPLAY, lineHeight: 1 }}>
              {d.getDate()}
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontFamily: BODY, fontSize: 12, color: SLATE, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Select Time
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 20 }}>
        {times.map(t => (
          <button
            key={t} onClick={() => setSelectedTime(t)} type="button"
            style={{
              padding: '9px 4px', borderRadius: 8, border: '2px solid',
              borderColor: selectedTime === t ? TEAL : '#e2e8f0',
              background: selectedTime === t ? '#e6f9fd' : '#fff',
              cursor: 'pointer', fontFamily: BODY, fontSize: 12, fontWeight: 600,
              color: selectedTime === t ? TEAL : NAVY, transition: 'all 0.15s',
            }}
          >{t}</button>
        ))}
      </div>

      {step === 'pick' && (
        <button
          type="button"
          onClick={() => { if (selectedTime) setStep('form') }}
          disabled={!selectedTime}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            cursor: selectedTime ? 'pointer' : 'not-allowed',
            background: selectedTime ? TEAL : '#cbd5e1',
            color: '#fff', fontFamily: DISPLAY, fontSize: 15, fontWeight: 700,
            transition: 'all 0.2s',
            boxShadow: selectedTime ? '0 4px 16px rgba(0,178,204,0.35)' : 'none',
          }}
        >
          {selectedTime ? 'Continue →' : 'Select a time to continue'}
        </button>
      )}

      {step === 'form' && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', fontFamily: BODY, fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>
            📅 {selectedDay === 0 ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][days[selectedDay].getDay()]} {days[selectedDay].getMonth() + 1}/{days[selectedDay].getDate()} at {selectedTime}
          </div>
          {profileLoaded && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534', marginBottom: 4 }}>
              ✓ Pre-filled from your account
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input required placeholder="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 13, outline: 'none' }} />
            <input placeholder="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 13, outline: 'none' }} />
          </div>
          <input required type="email" placeholder="Email Address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 13, outline: 'none' }} />
          <input required placeholder="Phone Number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 13, outline: 'none' }} />
          <button type="submit" style={{ background: TEAL, color: '#fff', border: 'none', padding: '13px', borderRadius: 10, fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,178,204,0.35)' }}>
            Confirm Showing Request
          </button>
          <button type="button" onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: SLATE, fontFamily: BODY, fontSize: 12, cursor: 'pointer' }}>
            ← Change date/time
          </button>
        </form>
      )}

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#94a3b8', fontFamily: BODY }}>
        Free cancellation · No commitment required
      </div>
    </div>
  )
}
