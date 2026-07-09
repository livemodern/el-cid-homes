// Fire-and-forget call into mlg-admin's lead-routing engine. mlg-admin owns
// the routing_rules table and decides which agent (or round-robin team
// member) should get a fresh lead. We mirror every lead through it so the
// routing decision is logged in lead_routing_decisions for CRM/marketing
// analytics — even while FUB is still the active assignment path.
//
// Mirrors mlg-site's copy at /Users/livemodern/mlg-site/src/lib/route-lead-client.ts.
// Keep in parity — any change here goes there too (and vice versa).
//
// Auth: shared MLG_SERVICE_TOKEN env var. Set on both sides.
// Never expose this token client-side; only use this helper from server
// routes / server actions.

const ADMIN_BASE = process.env.MLG_ADMIN_BASE_URL ?? 'https://team.mlrecloud.com'
const TOKEN = process.env.MLG_SERVICE_TOKEN

export interface RouteLeadInput {
  source?: string
  contact?: { id?: string | null; name?: string | null; email?: string | null; phone?: string | null }
  listing?: {
    mls_id?: string | null
    community_slug?: string | null
    zip?: string | null
    city?: string | null
    price?: number | null
    list_agent_mls_id?: string | null
    co_list_agent_mls_id?: string | null
  }
  tags?: string[]
  meta?: Record<string, unknown>
}

export interface RouteLeadResult {
  agent_id: string | null
  agent: { id: string; name: string; email: string | null; cell_phone: string | null; twilio_phone_number: string | null } | null
  reason: string
  matched_rule_id: string | null
  team_id: string | null
  decision_id: string | null
}

// Returns null on any failure — never throws. Routing is a record-keeping
// signal; a transient outage on mlg-admin must NOT break the user-facing
// form submission.
export async function recordLeadRouting(input: RouteLeadInput): Promise<RouteLeadResult | null> {
  if (!TOKEN) {
    console.warn('[route-lead] MLG_SERVICE_TOKEN missing — skipping routing record')
    return null
  }
  try {
    const res = await fetch(`${ADMIN_BASE}/api/leads/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MLG-Service-Token': TOKEN,
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[route-lead] non-2xx from mlg-admin:', res.status)
      return null
    }
    return await res.json()
  } catch (e) {
    console.warn('[route-lead] network error:', e)
    return null
  }
}
