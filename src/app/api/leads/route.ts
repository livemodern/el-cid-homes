import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isBot } from '@/lib/lead-utils';
import { recordLeadRouting } from '@/lib/route-lead-client';

// Lazy init — module-scope createClient crashes builds in environments
// (e.g. Preview) where Supabase env vars aren't exposed.
let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, firstName, lastName, email, phone,
      message, source,
      mls_id, listing, listPrice,
      showingDate, showingTime, showingType,
      siteSlug = 'el-cid-homes',
      // Registration flag — set when called from signUp
      isRegistration = false,
      // What best describes you (Buyer/Seller/Investor/etc.) — used as a
      // tag AND the structured contacts.client_type post-FUB write.
      userType,
      // Pre-registration browsing history from the client (localStorage) — fed
      // to the routing engine's enrichment brain.
      viewedMlsIds,
    } = body;

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    let first = firstName, last = lastName;
    if (!first && name) {
      const parts = String(name).trim().split(' ');
      first = parts[0];
      last = parts.slice(1).join(' ') || undefined;
    }

    const contact = { firstName: first, lastName: last, email, phone };

    // Bot check
    if (isBot({ ...contact, message })) {
      return NextResponse.json({ success: true }); // silent reject
    }

    // 1. Save to Supabase leads table
    const { data: lead } = await getSupabase().from('leads').insert({
      first_name:      first || null,
      last_name:       last  || null,
      email:           email || null,
      phone:           phone || null,
      message:         message || null,
      source_site:     siteSlug,
      source_type:     isRegistration ? 'registration' : (source || 'contact-form'),
      mls_id:          mls_id || null,
      listing_address: listing || null,
    }).select().maybeSingle();

    // userType lowercased becomes a FUB tag (mirrors mlg-site behavior).
    const userTypeTag = typeof userType === 'string' && userType.trim()
      ? [userType.trim().toLowerCase()]
      : [];

    // 2. Send to FUB + record routing — AWAITED inline. Vercel Next 14
    // kills the function instance once the response returns, so any work
    // we don't await silently dies — same lesson mlg-site learned. The
    // response is delayed ~1-2s but every step (route, FUB create,
    // assignment, CRM bridge) reliably completes.
    await (async () => {
      try {
        // 2a. Route — mlg-admin owns the rule engine. Records the decision
        // in lead_routing_decisions, creates/merges the native contact,
        // fires the agent alerts, and writes the wall activity.
        // Source is 'el-cid-homes'; community_slug 'el-cid-west-palm-beach'
        // carries the neighborhood context so community/geo rules resolve. The
        // featured-agent pin is DISPLAY ONLY — it does not route leads. El Cid
        // leads route via the rule engine (site rule -> Luxury Buyers, or the
        // seller/renter peel-offs). Action type ('registration', etc.) + the
        // computed sale/lease + client-type tags drive rule matching.
        const actionTag = isRegistration ? 'registration' : (source || 'contact-form');
        const routing = await recordLeadRouting({
          source: 'el-cid-homes',
          contact: { name: [first, last].filter(Boolean).join(' ') || null, email: email || null, phone: phone || null },
          listing: {
            mls_id: mls_id || null,
            community_slug: 'el-cid-west-palm-beach',
            zip:  '33401',
            city: 'West Palm Beach',  // El Cid is zip 33401, West Palm Beach
            price: typeof listPrice === 'number' ? listPrice : null,
          },
          tags: [
            actionTag,
            ...(userTypeTag.length ? userTypeTag : []),
          ].filter(Boolean),
          userType: typeof userType === 'string' ? userType : undefined,
          viewedMlsIds: Array.isArray(viewedMlsIds) ? viewedMlsIds : undefined,
          meta: {
            action: actionTag,
            message: message || null,
            listing_address: listing || null,
            site_slug: siteSlug,
          },
        });

        // OUR contact id. mlg-admin's /api/leads/route now CREATES the contact (or
        // soft-merges an existing one) when it routes the lead, and hands back its id.
        // Follow Up Boss is no longer the identity provider — it's a downstream mirror.
        //
        // The native work below used to be gated behind the FUB person id, and resolved
        // our OWN contact by looking it up through FUB. If FUB was slow, rate-limited,
        // or gone, none of it happened — silently.
        const contactId = routing?.contact_id ?? null;
        // (FUB person creation, owner PUT, and fub_id writeback DELETED —
        // Patrick 2026-07-23. mlg-admin's routing endpoint above owns
        // identity, assignment, native agent alerts, AND the wall's
        // lead_event activity record.)

        // Native CRM bridge — write contacts.client_type + stamp
        // site_events.contact_id (post-reg + pre-reg adoption via session_id).
        // Mirrors mlg-site's /api/leads bridge (commit e1b22e6). Patrick
        // 2026-06-25: don't trust FUB to round-trip customFields.
        if (isRegistration && contactId && email) {
          try {
            const sb2 = getSupabase();
            if (userType) {
              await sb2.from('contacts').update({ client_type: String(userType).trim() }).eq('id', contactId);
            }
            const { data: regNow } = await sb2.from('registrations')
              .select('user_id').ilike('email', email).maybeSingle();
            if (regNow?.user_id) {
              await sb2.from('site_events').update({ contact_id: contactId }).eq('user_id', regNow.user_id).is('contact_id', null);
              const { data: ses } = await sb2.from('site_events').select('session_id').eq('user_id', regNow.user_id).not('session_id', 'is', null).limit(50);
              const sids = Array.from(new Set((ses ?? []).map((r: any) => r.session_id).filter(Boolean)));
              if (sids.length > 0) {
                await sb2.from('site_events').update({ contact_id: contactId }).in('session_id', sids).is('contact_id', null);
              }
            }
          } catch (e) {
            console.warn('native CRM bridge failed (non-fatal):', e);
          }
        }
      } catch (e) {
        console.error('FUB lead submission failed (non-fatal):', e);
      }
    })();

    return NextResponse.json({ success: true, leadId: lead?.id });

  } catch (err) {
    console.error('Lead capture error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
