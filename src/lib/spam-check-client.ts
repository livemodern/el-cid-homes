// lib/spam-check-client.ts
//
// Calls mlg-admin's central lead classifier (/api/leads/spam-check) — layer 0
// identity heuristics, then keyword filter, then Claude. Same gate mlg-site,
// livemodern-site and the mini fleet run, tuned in ONE place.
//
// The local isBot() in lead-utils is the free pre-filter; this is what also
// catches coherent B2B solicitation (SEO audits, lead-gen pitches, VA
// services) that reads as a perfectly well-formed human.
//
// Auth: shared MLG_SERVICE_TOKEN (server-only — never client). If the env var
// is missing the check is skipped entirely, exactly like lead routing — so if
// spam is getting through here, check that it is set on the Vercel project.
// FAIL-OPEN: returns { spam: false } on any error. A real lead must NEVER be
// dropped by an infra hiccup; the classifier is fail-open on its side too.

const ADMIN_BASE = process.env.MLG_ADMIN_BASE_URL ?? "https://team.mlrecloud.com";
const TOKEN = process.env.MLG_SERVICE_TOKEN;

export interface SpamCheckInput {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  /** sites.slug — recorded on the rejection row in lead_spam_log. */
  source?: string | null;
}

export async function checkLeadSpam(
  input: SpamCheckInput,
): Promise<{ spam: boolean; reason: string }> {
  if (!TOKEN) return { spam: false, reason: "no-token" };
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${ADMIN_BASE}/api/leads/spam-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MLG-Service-Token": TOKEN,
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(to);
    if (!res.ok) return { spam: false, reason: `http-${res.status}` };
    const data = (await res.json()) as { spam?: boolean; reason?: string };
    return { spam: !!data.spam, reason: String(data.reason ?? "") };
  } catch {
    return { spam: false, reason: "error" };
  }
}
