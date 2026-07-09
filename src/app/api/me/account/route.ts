import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validatePhoneFormat, lookupPhone, isVoip } from '@/lib/phone'
import { submitRegistration, findPersonByEmail, postNote } from '@/lib/fub'

// Inline equivalent of mlg-site's @/lib/agents agentSlug — TCP doesn't carry
// the full agents helper, but this single utility is all this route uses.
function agentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// ─── /api/me/account — the client account hub ────────────────────────
// GET  → profile (name, primary phone + labeled extra phones, primary
//        login email + secondary emails + any pending email change,
//        member-since) and the client's assigned agent (resolved from the
//        CRM by email → contacts → assigned_to_id/assigned_to → agents).
// POST → { action: 'name' | 'add_phone' | 'set_primary_phone'
//        | 'add_email' | 'capture_prev_email' | 'request_removal'
//        | 'security_event' }
//        Clients can add numbers/emails and change which is primary, but
//        can NEVER delete one — removal is a request that lands on the CRM
//        timeline for an agent to action. Changing the primary LOGIN email
//        happens client-side via Supabase (email-change confirmation); the
//        old login email is retained here as a secondary.

export const dynamic = 'force-dynamic'

const PHONE_LABELS = ['Home', 'Cell', 'Work', 'Other']
const MAX_EXTRA_PHONES = 3
const MAX_EXTRA_EMAILS = 5
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const sb = getServiceClient()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

const norm = (p: string) => (p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
const lc = (s: string) => (s || '').trim().toLowerCase()

interface ExtraPhone { label: string; number: string }
interface ExtraEmail { email: string }

async function loadRegistration(sb: any, userId: string) {
  // extra_phones / extra_emails may not exist yet (migration pending) — fall back.
  let reg: any = null
  let enabled = true
  const full = await sb.from('registrations')
    .select('first_name, last_name, phone, extra_phones, extra_emails, photo_url, created_at, email')
    .eq('user_id', userId).maybeSingle()
  if (full.error && /(extra_phones|extra_emails|photo_url)/.test(full.error.message || '')) {
    enabled = false
    const basic = await sb.from('registrations')
      .select('first_name, last_name, phone, created_at, email')
      .eq('user_id', userId).maybeSingle()
    reg = basic.data
  } else {
    reg = full.data
  }
  return { reg, phonesEnabled: enabled, emailsEnabled: enabled }
}

// House-default when a contact has no owner (Pond) or is unknown. Mirrors
// mlg-admin's lead-routing fallback so the /account agent card never reads
// "unassigned" for a logged-in client. Patrick 2026-06-25.
const HOUSE_DEFAULT_AGENT_NAME = 'Jonathan Santiago'

async function loadHouseDefaultAgent(sb: any) {
  const { data } = await sb.from('agents')
    .select('name, title, photo_url, cell_phone, office_phone, email')
    .eq('name', HOUSE_DEFAULT_AGENT_NAME).eq('active', true).maybeSingle()
  if (!data) return null
  return {
    name: data.name,
    title: data.title,
    photo_url: data.photo_url,
    phone: data.cell_phone || data.office_phone,
    email: data.email,
    slug: agentSlug(data.name),
  }
}

async function resolveAssignedAgent(sb: any, email: string | null) {
  if (!email) return loadHouseDefaultAgent(sb)
  const enc = JSON.stringify([{ value: email }])
  const { data: contacts } = await sb.from('contacts')
    .select('id, assigned_to, assigned_to_id, archived_at')
    .or(`email.eq.${email},emails.cs.${enc}`)
    .limit(5)
  const contact = (contacts ?? []).find((c: any) => !c.archived_at) || (contacts ?? [])[0]
  if (!contact || (!contact.assigned_to && !contact.assigned_to_id)) {
    return loadHouseDefaultAgent(sb)
  }

  let agent: any = null
  if (contact.assigned_to_id != null) {
    const { data } = await sb.from('agents')
      .select('name, title, photo_url, cell_phone, office_phone, email, active, fub_id')
      .eq('fub_id', contact.assigned_to_id).eq('active', true).maybeSingle()
    agent = data
  }
  if (!agent && contact.assigned_to) {
    const { data } = await sb.from('agents')
      .select('name, title, photo_url, cell_phone, office_phone, email, active')
      .eq('name', contact.assigned_to).eq('active', true).maybeSingle()
    agent = data
  }
  if (!agent) return loadHouseDefaultAgent(sb)
  return {
    name: agent.name,
    title: agent.title,
    photo_url: agent.photo_url,
    phone: agent.cell_phone || agent.office_phone,
    email: agent.email,
    slug: agentSlug(agent.name),
  }
}

async function resolveContactId(sb: any, email: string | null): Promise<string | null> {
  if (!email) return null
  const enc = JSON.stringify([{ value: email }])
  const { data } = await sb.from('contacts').select('id, archived_at')
    .or(`email.eq.${email},emails.cs.${enc}`).limit(5)
  const c = (data ?? []).find((x: any) => !x.archived_at) || (data ?? [])[0]
  return c?.id ?? null
}

// Append an email to a contact's emails[] jsonb (shape: [{ value }]).
async function appendContactEmail(sb: any, contactId: string, email: string) {
  try {
    const { data } = await sb.from('contacts').select('emails, email').eq('id', contactId).maybeSingle()
    const arr: any[] = Array.isArray(data?.emails) ? data.emails : []
    const present = lc(data?.email || '') === lc(email) || arr.some((e: any) => lc(e?.value || e || '') === lc(email))
    if (present) return
    await sb.from('contacts').update({ emails: [...arr, { value: email }] }).eq('id', contactId)
  } catch { /* best-effort */ }
}

// Post a note both to the native CRM timeline and to FUB. Best-effort.
async function timelineNote(sb: any, email: string | null, msg: string) {
  if (!email) return
  const contactId = await resolveContactId(sb, email)
  if (contactId) {
    try {
      await sb.from('contact_activity').insert({
        contact_id: contactId, type: 'note', body: msg,
        created_by: 'system:account', activity_at: new Date().toISOString(),
      })
    } catch { /* non-fatal — FUB note is the durable copy */ }
  }
  findPersonByEmail(email).then((pid: number | null) => { if (pid) postNote(pid, msg) }).catch(() => {})
}

export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = getServiceClient()

  const { reg, phonesEnabled, emailsEnabled } = await loadRegistration(sb, user.id)
  const agent = await resolveAssignedAgent(sb, user.email || reg?.email || null)

  // Provider avatar (Google) — capture opportunistically; best-effort.
  const meta: any = user.user_metadata || {}
  const providerPhoto: string | null = meta.picture || meta.avatar_url || null
  let photoUrl: string | null = (reg as any)?.photo_url || null
  if (providerPhoto && /^https:\/\//.test(providerPhoto) && providerPhoto !== photoUrl && reg) {
    const { error } = await sb.from('registrations').update({ photo_url: providerPhoto }).eq('user_id', user.id)
    if (!error) photoUrl = providerPhoto
    else if (!photoUrl) photoUrl = providerPhoto
  }

  // ── Email model ──
  // Primary = the Supabase login email (user.email). A pending change lives
  // in user.new_email until the confirmation link is clicked. Secondaries
  // live in registrations.extra_emails. Reconcile: once a change settles
  // (no pending), the login email must not linger as a secondary.
  const pending = (user as any).new_email || ''
  let extraEmails: ExtraEmail[] = ((reg?.extra_emails as ExtraEmail[]) || []).filter(e => !!e?.email)
  if (!pending && reg) {
    const filtered = extraEmails.filter(e => lc(e.email) !== lc(user.email || ''))
    if (filtered.length !== extraEmails.length) {
      await sb.from('registrations').update({ extra_emails: filtered }).eq('user_id', user.id)
      extraEmails = filtered
    }
  }
  // Display secondaries: exclude primary + pending, dedupe.
  const seen = new Set<string>()
  const displayEmails = extraEmails.filter(e => {
    const k = lc(e.email)
    if (!k || k === lc(user.email || '') || k === lc(pending) || seen.has(k)) return false
    seen.add(k); return true
  })

  return NextResponse.json({
    profile: {
      first_name: reg?.first_name || null,
      last_name: reg?.last_name || null,
      phone: reg?.phone || null,
      extra_phones: (reg?.extra_phones as ExtraPhone[]) || [],
      email: user.email,
      extra_emails: displayEmails,
      pending_email: pending || null,
      photo_url: photoUrl,
      member_since: reg?.created_at || user.created_at,
    },
    phonesEnabled,
    emailsEnabled,
    agent,
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const sb = getServiceClient()
  const { reg, phonesEnabled, emailsEnabled } = await loadRegistration(sb, user.id)
  if (!reg) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

  // ── Edit name ──
  if (body.action === 'name') {
    const firstName = String(body.firstName || '').trim()
    const lastName = String(body.lastName || '').trim()
    if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    if (firstName.length > 60 || lastName.length > 60) {
      return NextResponse.json({ error: 'That name looks too long' }, { status: 400 })
    }
    const { error } = await sb.from('registrations')
      .update({ first_name: firstName, last_name: lastName || null })
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await sb.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), first_name: firstName, last_name: lastName || null },
      })
    } catch { /* non-fatal */ }

    if (user.email && reg.phone) {
      submitRegistration({
        contact: { firstName, lastName: lastName || undefined, email: user.email, phone: reg.phone },
        siteSlug: 'mlg-site',
        tags: ['profile-updated'],
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // ── Add a phone (labeled extra, or new primary) ──
  if (body.action === 'add_phone') {
    if (!phonesEnabled) return NextResponse.json({ error: 'Additional numbers are not available yet, check back shortly.' }, { status: 503 })
    const raw = String(body.number || '').trim()
    const fmt = validatePhoneFormat(raw)
    if (!fmt.ok) return NextResponse.json({ error: fmt.reason }, { status: 400 })
    const look = await lookupPhone(fmt.e164)
    if (look.valid === false) {
      return NextResponse.json({ error: "That number doesn't appear to be in service, double-check it?" }, { status: 400 })
    }
    const extras: ExtraPhone[] = (reg.extra_phones as ExtraPhone[]) || []
    const n = norm(raw)
    if (norm(reg.phone || '') === n || extras.some(p => norm(p.number) === n)) {
      return NextResponse.json({ error: 'That number is already on your profile.' }, { status: 400 })
    }

    // Make this new number the primary; demote the old primary to "Other" (retained).
    if (body.makePrimary) {
      const demoted: ExtraPhone[] = reg.phone ? [{ label: 'Other', number: reg.phone }] : []
      const next = [...demoted, ...extras]
      const { error } = await sb.from('registrations').update({ phone: raw, extra_phones: next }).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (user.email) {
        timelineNote(sb, user.email, `Client set a new primary phone number from their account page: ${raw}${isVoip(look.lineType) ? ' (VoIP)' : ''}. Previous primary kept as Other.`)
      }
      return NextResponse.json({ ok: true, phone: raw, extra_phones: next })
    }

    // Otherwise add as a labeled extra (capped).
    if (extras.length >= MAX_EXTRA_PHONES) {
      return NextResponse.json({ error: `You can add up to ${MAX_EXTRA_PHONES} additional numbers.` }, { status: 400 })
    }
    const label = PHONE_LABELS.includes(body.label) ? body.label : 'Other'
    const next = [...extras, { label, number: raw }]
    const { error } = await sb.from('registrations').update({ extra_phones: next }).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (user.email) {
      timelineNote(sb, user.email, `Client added a ${label.toLowerCase()} number from their account page: ${raw}${isVoip(look.lineType) ? ' (VoIP)' : ''}`)
    }
    return NextResponse.json({ ok: true, extra_phones: next })
  }

  // ── Promote an existing number to primary; old primary → "Other" ──
  if (body.action === 'set_primary_phone') {
    if (!phonesEnabled) return NextResponse.json({ error: 'Not available yet.' }, { status: 503 })
    const raw = String(body.number || '').trim()
    const n = norm(raw)
    if (!n) return NextResponse.json({ error: 'Pick a number to make primary.' }, { status: 400 })
    if (norm(reg.phone || '') === n) return NextResponse.json({ ok: true, phone: reg.phone, extra_phones: reg.extra_phones || [] })
    const extras: ExtraPhone[] = (reg.extra_phones as ExtraPhone[]) || []
    const chosen = extras.find(p => norm(p.number) === n)
    if (!chosen) return NextResponse.json({ error: 'That number isn’t on your profile.' }, { status: 400 })
    const demoted: ExtraPhone[] = reg.phone ? [{ label: 'Other', number: reg.phone }] : []
    const next = [...demoted, ...extras.filter(p => norm(p.number) !== n)]
    const { error } = await sb.from('registrations').update({ phone: chosen.number, extra_phones: next }).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (user.email) {
      timelineNote(sb, user.email, `Client changed their primary phone number from their account page to: ${chosen.number}. Previous primary kept as Other.`)
    }
    return NextResponse.json({ ok: true, phone: chosen.number, extra_phones: next })
  }

  // ── Add a secondary email ──
  if (body.action === 'add_email') {
    if (!emailsEnabled) return NextResponse.json({ error: 'Adding emails isn’t available yet, check back shortly.' }, { status: 503 })
    const raw = lc(String(body.email || ''))
    if (!EMAIL_RE.test(raw)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    const primary = lc(user.email || '')
    const pending = lc((user as any).new_email || '')
    const extras: ExtraEmail[] = ((reg.extra_emails as ExtraEmail[]) || []).filter(e => !!e?.email)
    if (raw === primary || raw === pending || extras.some(e => lc(e.email) === raw)) {
      return NextResponse.json({ error: 'That email is already on your profile.' }, { status: 400 })
    }
    if (extras.length >= MAX_EXTRA_EMAILS) {
      return NextResponse.json({ error: `You can add up to ${MAX_EXTRA_EMAILS} additional emails.` }, { status: 400 })
    }
    const next = [...extras, { email: raw }]
    const { error } = await sb.from('registrations').update({ extra_emails: next }).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Sync to the CRM contact + timeline.
    if (user.email) {
      const contactId = await resolveContactId(sb, user.email)
      if (contactId) await appendContactEmail(sb, contactId, raw)
      timelineNote(sb, user.email, `Client added an email to their account page: ${raw}`)
    }
    return NextResponse.json({ ok: true, extra_emails: next })
  }

  // ── Capture the old login email as a secondary (called by the client
  //    right after it kicks off a primary-login email change) so the
  //    previous address is retained once the change confirms. ──
  if (body.action === 'capture_prev_email') {
    if (!emailsEnabled) return NextResponse.json({ ok: true })
    const old = lc(user.email || '')
    const extras: ExtraEmail[] = ((reg.extra_emails as ExtraEmail[]) || []).filter(e => !!e?.email)
    if (old && !extras.some(e => lc(e.email) === old)) {
      await sb.from('registrations').update({ extra_emails: [...extras, { email: old }] }).eq('user_id', user.id)
    }
    const newEmail = lc(String(body.newEmail || (user as any).new_email || ''))
    if (old) {
      timelineNote(sb, old, `Client requested to change their primary login email${newEmail ? ` to ${newEmail}` : ''} (pending email confirmation).`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Request removal of a phone/email (we never delete — an agent does) ──
  if (body.action === 'request_removal') {
    const kind = body.kind === 'email' ? 'email' : 'phone'
    const value = String(body.value || '').trim()
    if (!value) return NextResponse.json({ error: 'Nothing to remove.' }, { status: 400 })
    const email = user.email || reg.email || null
    const msg = `Client requested removal of ${kind === 'email' ? 'email address' : 'phone number'} "${value}" from their profile — please remove it in the CRM.`
    timelineNote(sb, email, msg)
    return NextResponse.json({ ok: true })
  }

  // ── Log a self-service security event to the CRM timeline ──
  if (body.action === 'security_event') {
    const EVENTS: Record<string, string> = {
      password_set:     'Client set an account password from their account page.',
      password_changed: 'Client changed their account password from their account page.',
    }
    const msg = EVENTS[String(body.event || '')]
    if (!msg) return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    timelineNote(sb, user.email || reg.email || null, msg)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
