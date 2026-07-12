// ─── lib/fub.ts — Follow Up Boss API client ───────────────────────────
// ALL activity goes through POST /events — this is the ONLY correct way
// to populate the FUB Activity section (viewed properties, inquiries, etc.)
// and to create contacts with deduplication.
//
// Event types that populate the Activity section:
//   "Registration"     → creates/updates contact, logs registration
//   "Viewed Property"  → populates "Viewed" in Activity, contributes to avg price
//   "Property Inquiry" → populates Inquiries section, triggers automations
//   "Saved Property"   → populates "Saved" in Activity
//   "General Inquiry"  → generic contact form submission
//
// Source: https://docs.followupboss.com/reference/events-post
// Source: https://docs.followupboss.com/docs/start-here-brand-new-integration

const FUB_BASE   = 'https://api.followupboss.com/v1';
const FUB_SYSTEM = 'ModernLivingGroup';

function authHeader() {
  const key = process.env.FUB_API_KEY || process.env.FOLLOW_UP_BOSS_API_KEY || '';
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

function systemKey() {
  return process.env.FUB_API_KEY || process.env.FOLLOW_UP_BOSS_API_KEY || '';
}

async function fubFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/json',
      'X-System':      FUB_SYSTEM,
      'X-System-Key':  systemKey(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return { success: true };
  const text = await res.text();
  if (!text) return { success: true };
  if (!res.ok) {
    throw new Error(`FUB ${options.method || 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

// ─── Bot detection ────────────────────────────────────────────────────
export function botScore(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
}): number {
  let score = 0;
  const words = [data.firstName, data.lastName].filter(Boolean) as string[];
  for (const word of words) {
    if (word.length > 12) score += 30;
    const internalUpper = (word.slice(1).match(/[A-Z]/g) || []).length;
    if (internalUpper >= 3) score += 40;
  }
  if (data.email) {
    const local = data.email.split('@')[0];
    if ((local.match(/\./g) || []).length >= 3) score += 30;
  }
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) score += 20;
  }
  if (data.message && /[^\x20-\x7E]/.test(data.message)) score += 40;
  return score;
}

export function isBot(data: Parameters<typeof botScore>[0]): boolean {
  return botScore(data) >= 50;
}

// ─── Phone sanitizer ─────────────────────────────────────────────────
function sanitizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/\D/g, '') || undefined;
}

// ─── Source mapping ───────────────────────────────────────────────────
// source = domain name of the site. IMMUTABLE on FUB — set on create only.
const SOURCE_MAP: Record<string, string> = {
  'mlg-search':   'search.mlrecloud.com',
  'el-cid-homes': 'elcidhomes.com',
};
function fubSource(siteSlug?: string, override?: string): string {
  if (override) return override;
  return siteSlug ? (SOURCE_MAP[siteSlug] || 'modernlivingre.com') : 'modernlivingre.com';
}

// ─── Base event builder ───────────────────────────────────────────────
// All FUB events share this flat structure. Fields go at top level.
// Docs: https://docs.followupboss.com/docs/start-here-brand-new-integration
// Build a correctly structured FUB event.
// Per https://docs.followupboss.com/reference/events-post:
//   - person and property are NESTED objects, not flat fields
//   - source = domain name (no www.)
function buildEvent(params: {
  type: string;
  source: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
  stage?: string;
  tags?: string[];
  // Property fields (nested under "property" in the request)
  propertyStreetAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyMlsNumber?: string;
  propertyPrice?: number;
  propertyUrl?: string;
  propertyBeds?: number;
  propertyBaths?: number;
  propertySqft?: number;
}) {
  const event: Record<string, any> = {
    system: FUB_SYSTEM,
    type:   params.type,
    source: params.source,
  };

  if (params.message) event.message = params.message;

  // Person — nested object
  const person: Record<string, any> = {};
  if (params.firstName) person.firstName = params.firstName;
  if (params.lastName)  person.lastName  = params.lastName;
  if (params.email)     person.emails    = [{ value: params.email }];
  if (params.phone) {
    const digits = sanitizePhone(params.phone);
    if (digits)         person.phones    = [{ value: digits, type: 'mobile' }];
  }
  if (params.stage)        person.stage = params.stage;
  if (params.tags?.length) person.tags  = params.tags;
  if (Object.keys(person).length > 0) event.person = person;

  // Property — nested object
  const property: Record<string, any> = {};
  if (params.propertyStreetAddress) property.street = params.propertyStreetAddress;
  if (params.propertyCity)          property.city          = params.propertyCity;
  if (params.propertyState)         property.state         = params.propertyState;
  if (params.propertyZip)           property.zip           = params.propertyZip;
  if (params.propertyMlsNumber)     property.mlsNumber     = params.propertyMlsNumber;
  if (params.propertyPrice)         property.price         = params.propertyPrice;
  if (params.propertyUrl)           property.url           = params.propertyUrl;
  if (params.propertyBeds)          property.beds          = params.propertyBeds;
  if (params.propertyBaths)         property.baths         = params.propertyBaths;
  if (params.propertySqft)          property.area          = params.propertySqft;
  if (Object.keys(property).length > 0) event.property = property;

  return event;
}

// ─── Types ────────────────────────────────────────────────────────────

export type FubContactInfo = {
  firstName?: string;
  lastName?:  string;
  email?:     string;
  phone?:     string;
};

export type FubPropertyInfo = {
  mlsId?:         string;
  streetAddress?: string;
  city?:          string;
  state?:         string;
  zip?:           string;
  listPrice?:     number;
  beds?:          number;
  baths?:         number;
  sqft?:          number;
  url?:           string;  // full URL to the listing page
};

// FUB's POST /events response returns the created/merged PERSON object
// directly (keys: id, emails, firstName, ...) — NOT a nested {person:{id}}.
// The old data?.person?.id reads were always undefined, so personId never
// propagated to the owner-override + fub_id writeback. Port of mlg-site
// extractPersonId. 2026-06-25.
function extractPersonId(data: any): number | undefined {
  if (!data) return undefined;
  const looksLikePerson =
    data.emails != null || data.firstName != null || data.lastName != null || data.name != null;
  const id = (data.personId ?? data.person?.id ?? data.people?.[0]?.id ??
    (looksLikePerson ? data.id : undefined)) as number | undefined;
  return id ?? undefined;
}

// ─── Person + activity-note builders (POST /v1/people path) ───────────
// Switched from /v1/events to /v1/people because FUB's events endpoint
// silently 204-rejects when source matches an archived Lead Flow. Same
// migration as mlg-site (Patrick 2026-06-27). Activity goes in a /v1/notes
// post instead of the event message field.
function buildPerson(params: {
  source: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  stage?: string;
  tags?: string[];
}): Record<string, any> {
  const person: Record<string, any> = { source: params.source };
  if (params.firstName) person.firstName = params.firstName;
  if (params.lastName)  person.lastName  = params.lastName;
  if (params.email)     person.emails    = [{ value: params.email }];
  if (params.phone) {
    const digits = sanitizePhone(params.phone);
    if (digits)         person.phones    = [{ value: digits, type: 'mobile' }];
  }
  if (params.stage)        person.stage = params.stage;
  if (params.tags?.length) person.tags  = params.tags;
  return person;
}

function buildActivityNote(
  activity: string,
  opts: {
    source?: string;
    message?: string;
    property?: { mlsId?: string; address?: string; city?: string; price?: number; url?: string };
    extras?: string[];
  } = {},
): string {
  const lines: string[] = [`📝 ${activity}`];
  if (opts.source) lines.push(`Source: ${opts.source}`);
  if (opts.property) {
    const bits: string[] = [];
    if (opts.property.mlsId)   bits.push(`MLS# ${opts.property.mlsId}`);
    if (opts.property.address) bits.push(opts.property.address);
    if (opts.property.city)    bits.push(opts.property.city);
    if (opts.property.price)   bits.push('$' + Number(opts.property.price).toLocaleString());
    if (bits.length) lines.push(`Property: ${bits.join(' · ')}`);
    if (opts.property.url) lines.push(`Link: ${opts.property.url}`);
  }
  if (opts.extras?.length) lines.push(...opts.extras);
  if (opts.message) lines.push(`Message: ${opts.message}`);
  return lines.join('\n');
}

// Upsert by email into /v1/people, then POST an activity note. Best-effort
// note — failure logs but doesn't block contact creation.
async function upsertPersonAndLogActivity(
  personPayload: Record<string, any>,
  noteBody: string,
): Promise<number | undefined> {
  // ONE CONTACT PER EMAIL. FUB's POST /people does NOT reliably merge by email
  // on this account (a single email has spawned multiple persons), so we look
  // the person up ourselves first. If they already exist we log the activity
  // note under them and DO NOT re-push the payload — re-pushing would reset a
  // returning client's stage/tags/source. Create only when there's no match.
  // Ported from mlg-site fub-events.ts (2026-07-11 fix). 2026-07-12.
  const email = (personPayload?.emails?.[0]?.value as string | undefined)?.trim();
  let personId: number | undefined;
  if (email) {
    const existing = await findPersonByEmail(email);
    if (existing) personId = existing;
  }
  if (!personId) {
    const data = await fubFetch('/people', { method: 'POST', body: JSON.stringify(personPayload) });
    personId = extractPersonId(data);
  }
  if (personId && noteBody) {
    try {
      await fubFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({ personId, body: noteBody, isHtml: false }),
      });
    } catch (e: any) {
      console.warn('FUB activity note failed (non-fatal):', e?.message);
    }
  }
  return personId;
}

// ─── 1. Registration ──────────────────────────────────────────────────
// Call when a new user signs up. Creates contact + logs registration event.
export async function submitRegistration(params: {
  contact: FubContactInfo;
  siteSlug: string;
  stage?: string;
  tags?: string[];
}): Promise<{ ok: boolean; personId?: number; error?: string }> {
  if (isBot(params.contact)) {
    console.warn('FUB submitRegistration: bot detected, skipping');
    return { ok: false, error: 'bot_detected' };
  }

  const source = fubSource(params.siteSlug);
  const person = buildPerson({
    source,
    stage: params.stage || 'Lead',
    tags:  params.tags,
    ...params.contact,
  });
  const note = buildActivityNote('Registration', { source });

  try {
    const personId = await upsertPersonAndLogActivity(person, note);
    console.log('FUB registration person upserted, personId:', personId);
    return { ok: true, personId };
  } catch (err: any) {
    console.error('FUB submitRegistration error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── 2. Property Viewed ───────────────────────────────────────────────
// Activity log on existing contact (found by email). Silent no-op if not in FUB.
export async function submitPropertyView(params: {
  contact: FubContactInfo;
  property: FubPropertyInfo;
  siteSlug: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.contact.email) return { ok: false, error: 'no_email' };
  const source = fubSource(params.siteSlug);
  try {
    const personId = await findPersonByEmail(params.contact.email);
    if (!personId) return { ok: true };
    const note = buildActivityNote('Viewed Property', {
      source,
      property: {
        mlsId:   params.property.mlsId,
        address: params.property.streetAddress,
        city:    params.property.city,
        price:   params.property.listPrice,
        url:     params.property.url,
      },
    });
    await fubFetch('/notes', { method: 'POST', body: JSON.stringify({ personId, body: note, isHtml: false }) });
    return { ok: true };
  } catch (err: any) {
    console.error('FUB submitPropertyView error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── 3. Property Inquiry (Showing Request / Contact Form) ─────────────
// Call when a user submits a showing request or contacts about a property.
// Populates "Inquiries" section in FUB Activity + triggers automations.
export async function submitPropertyInquiry(params: {
  contact: FubContactInfo;
  property: FubPropertyInfo;
  siteSlug: string;
  message?: string;
  showingDate?: string;
  showingTime?: string;
  showingType?: 'in-person' | 'video';
}): Promise<{ ok: boolean; personId?: number; error?: string }> {
  if (isBot(params.contact)) {
    return { ok: false, error: 'bot_detected' };
  }

  const source = fubSource(params.siteSlug);
  const isShowing = !!(params.showingDate || params.showingTime || params.showingType);

  const extras: string[] = [];
  if (params.showingDate)  extras.push(`Requested date: ${params.showingDate}`);
  if (params.showingTime)  extras.push(`Requested time: ${params.showingTime}`);
  if (params.showingType)  extras.push(`Type: ${params.showingType === 'video' ? 'Video Tour' : 'In-Person Showing'}`);

  const person = buildPerson({
    source,
    stage: 'Lead',
    tags:  ['buyer'],
    ...params.contact,
  });
  const note = buildActivityNote(isShowing ? 'Showing Request' : 'Property Inquiry', {
    source,
    property: {
      mlsId:   params.property.mlsId,
      address: params.property.streetAddress,
      city:    params.property.city,
      price:   params.property.listPrice,
      url:     params.property.url,
    },
    extras,
    message: params.message,
  });

  try {
    const personId = await upsertPersonAndLogActivity(person, note);
    return { ok: true, personId };
  } catch (err: any) {
    console.error('FUB submitPropertyInquiry error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── 4. Saved Property ────────────────────────────────────────────────
// Activity log on existing contact (found by email). Silent no-op if not in FUB.
export async function submitSavedProperty(params: {
  contact: FubContactInfo;
  property: FubPropertyInfo;
  siteSlug: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.contact.email) return { ok: false, error: 'no_email' };
  const source = fubSource(params.siteSlug);
  try {
    const personId = await findPersonByEmail(params.contact.email);
    if (!personId) return { ok: true };
    const note = buildActivityNote('Saved Property', {
      source,
      property: {
        mlsId:   params.property.mlsId,
        address: params.property.streetAddress,
        city:    params.property.city,
        price:   params.property.listPrice,
        url:     params.property.url,
      },
    });
    await fubFetch('/notes', { method: 'POST', body: JSON.stringify({ personId, body: note, isHtml: false }) });
    return { ok: true };
  } catch (err: any) {
    console.error('FUB submitSavedProperty error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── 5. General Contact Form ──────────────────────────────────────────
// For the /contact page — no specific property, just a message.
export async function submitGeneralInquiry(params: {
  contact: FubContactInfo;
  siteSlug: string;
  message?: string;
  source?: string;
}): Promise<{ ok: boolean; personId?: number; error?: string }> {
  if (isBot({ ...params.contact, message: params.message })) {
    return { ok: false, error: 'bot_detected' };
  }

  const source = fubSource(params.siteSlug, params.source);
  const person = buildPerson({
    source,
    stage: 'Lead',
    ...params.contact,
  });
  const note = buildActivityNote('General Inquiry', { source, message: params.message });

  try {
    const personId = await upsertPersonAndLogActivity(person, note);
    return { ok: true, personId };
  } catch (err: any) {
    console.error('FUB submitGeneralInquiry error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Backwards compat alias ───────────────────────────────────────────
// Keeps existing /api/leads route working
export async function submitLead(params: any) {
  if (params.showingDate || params.mlsId || params.address) {
    return submitPropertyInquiry({
      contact:  { firstName: params.firstName, lastName: params.lastName, email: params.email, phone: params.phone },
      property: { mlsId: params.mlsId, streetAddress: params.address, listPrice: params.listPrice },
      siteSlug: params.siteSlug || 'mlg-search',
      message:  params.message,
      showingDate: params.showingDate,
      showingTime: params.showingTime,
      showingType: params.showingType,
    });
  }
  return submitGeneralInquiry({
    contact:  { firstName: params.firstName, lastName: params.lastName, email: params.email, phone: params.phone },
    siteSlug: params.siteSlug || 'mlg-search',
    message:  params.message,
    source:   params.source,
  });
}

// ─── Post a note on an existing person ────────────────────────────────
export async function postNote(personId: number, body: string): Promise<boolean> {
  try {
    await fubFetch('/notes', {
      method: 'POST',
      // Note: userId intentionally omitted — FUB /notes rejects it
      body: JSON.stringify({ personId, body, isHtml: false }),
    });
    return true;
  } catch (err: any) {
    console.error('FUB postNote error:', err.message);
    return false;
  }
}

// ─── Create a task ────────────────────────────────────────────────────
export async function createTask(params: {
  personId: number;
  type: 'Call' | 'Email' | 'Text' | 'To-Do';
  note: string;
  dueDate: string;    // YYYY-MM-DD
  dueTime?: string;   // HH:MM EDT
  assignedUserId?: number;
  priority?: 'High' | 'Normal' | 'Low';
}): Promise<boolean> {
  try {
    await fubFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        personId:       params.personId,
        type:           params.type,
        note:           params.note,
        dueDate:        params.dueDate,
        dueTime:        params.dueTime || '09:00',
        assignedUserId: params.assignedUserId,
        priority:       params.priority || 'Normal',
      }),
    });
    return true;
  } catch (err: any) {
    console.error('FUB createTask error:', err.message);
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────
export async function findPersonByEmail(email: string): Promise<number | null> {
  try {
    const data = await fubFetch(`/people?email=${encodeURIComponent(email)}&limit=1`);
    return data?.people?.[0]?.id ?? null;
  } catch { return null; }
}

export async function getPerson(personId: number): Promise<any | null> {
  try {
    return await fubFetch(`/people/${personId}`);
  } catch { return null; }
}

export async function updatePerson(personId: number, fields: Record<string, any>): Promise<boolean> {
  const { source: _omit, ...safeFields } = fields;
  // A person created via POST /events isn't always immediately addressable at
  // PUT /people/{id} — FUB returns a transient 404 ("Requested resource not
  // found") for a few hundred ms after creation. Retry with backoff so the
  // router's chosen owner actually gets stamped (assignedUserId). Ported from
  // mlg-site fub-events.ts updatePerson. 2026-06-25.
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await fubFetch(`/people/${personId}`, { method: 'PUT', body: JSON.stringify(safeFields) });
      return true;
    } catch (err: any) {
      lastErr = String(err?.message || '');
      if (lastErr.includes(' 404:') && attempt < 4) {
        await new Promise(r => setTimeout(r, 600 * attempt));
        continue;
      }
      break;
    }
  }
  console.error('FUB updatePerson error:', lastErr);
  return false;
}
