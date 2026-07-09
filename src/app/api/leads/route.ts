import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submitRegistration, submitPropertyInquiry, submitGeneralInquiry, isBot, updatePerson, findPersonByEmail, postNote } from '@/lib/fub';
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
        // in lead_routing_decisions and returns the chosen agent so we can
        // stamp them as the FUB person's owner below (overriding FUB's
        // own lead-flow group assignment). Patrick 2026-06-25.
        // Source is 'el-cid-homes'; community_slug 'el-cid-west-palm-beach'
        // carries the neighborhood context so the community Featured-agent
        // pin (Patrick Lafferty) resolves and owns every El Cid lead. Action
        // type ('registration', 'contact-form', etc.) goes into tags for
        // audit + tag-based rule matching.
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
          meta: {
            action: actionTag,
            message: message || null,
            listing_address: listing || null,
            site_slug: siteSlug,
          },
        });

        let personId: number | undefined;
        if (isRegistration) {
          // New user signed up
          const reg = await submitRegistration({ contact, siteSlug, stage: 'Lead', tags: userTypeTag.length ? userTypeTag : undefined });
          personId = (reg as any)?.personId;

        } else if (mls_id || listing) {
          // Showing request or property-specific inquiry
          const inq = await submitPropertyInquiry({
            contact,
            property: {
              mlsId:         mls_id,
              streetAddress: listing,
              listPrice,
              // Additional property fields will be enriched by the viewed route
            },
            siteSlug,
            message,
            showingDate,
            showingTime,
            showingType,
          });
          personId = (inq as any)?.personId;

        } else {
          // Generic contact form
          const gen = await submitGeneralInquiry({ contact, siteSlug, message });
          personId = (gen as any)?.personId;
        }

        // FUB's POST /events response doesn't reliably surface person.id; since
        // FUB dedupes by email the person exists right after the create, so
        // resolve the id by email when the event response didn't give us one —
        // otherwise assignment + writeback below silently no-op. Ported from
        // mlg-site /api/leads (commit see fub-events.ts caller). 2026-06-25.
        if (!personId && email) {
          personId = (await findPersonByEmail(email)) ?? undefined;
        }

        // 2b. Router stamp — override FUB's lead-flow assignment with the
        // agent our routing engine picked. Guard: don't reassign a contact
        // that already has an owner (existing client should keep their
        // current agent). Mirrors mlg-site's owner-guard pattern.
        if (personId && routing?.agent_id) {
          let alreadyOwned = false;
          if (email) {
            try {
              const sbCheck = getSupabase();
              const { data: existing } = await sbCheck.from('contacts')
                .select('id, assigned_to_id, archived_at')
                .ilike('email', email).limit(5);
              alreadyOwned = !!(existing || []).find((c: any) => !c.archived_at && c.assigned_to_id != null);
            } catch (e) {
              console.warn('owner-guard lookup failed (non-fatal):', e);
            }
          }
          if (!alreadyOwned) {
            const sbAg = getSupabase();
            const { data: ag } = await sbAg.from('agents').select('fub_id, name').eq('id', routing.agent_id).maybeSingle();
            if (ag?.fub_id != null) {
              await updatePerson(personId, { assignedUserId: ag.fub_id });

              // Post @-mention note IMMEDIATELY after PUT — FUB person definitely
              // exists, and the routed agent is the FUB owner. FUB's mobile app
              // pushes a notification to the @-mentioned user. Mention requires
              // the FULL FUB user name verbatim. Patrick 2026-06-27.
              if (ag.name) {
                const display = [first, last].filter(Boolean).join(' ') || email || 'New lead';
                const phoneLine = phone ? ` · ${phone}` : '';
                const srcLine   = ` · elcidhomes.com (${isRegistration ? 'registration' : 'inquiry'})`;
                const listingLine = (listing || mls_id)
                  ? `\nProperty: ${[listing, mls_id ? `MLS# ${mls_id}` : null].filter(Boolean).join(' · ')}`
                  : '';
                const noteBody = `@${ag.name} 🔔 NEW LEAD assigned to you\n${display}${phoneLine}${srcLine}${listingLine}`;
                try {
                  await postNote(personId, noteBody);
                } catch (e) {
                  console.warn('FUB @-mention note failed (non-fatal):', e);
                }
              }
            }
          }
        }

        // 2c. Write FUB id back to the leads row so we can audit which TCP
        // leads actually landed in FUB and on whose desk. Mirrors mlg-site's
        // 2e writeback step.
        if (personId && lead?.id) {
          try {
            await getSupabase().from('leads')
              .update({ fub_id: personId, fub_synced_at: new Date().toISOString() })
              .eq('id', lead.id);
          } catch (e) {
            console.warn('TCP fub_id writeback failed (non-fatal):', e);
          }
        }

        // Native CRM bridge — write contacts.client_type + stamp
        // site_events.contact_id (post-reg + pre-reg adoption via session_id).
        // Mirrors mlg-site's /api/leads bridge (commit e1b22e6). Patrick
        // 2026-06-25: don't trust FUB to round-trip customFields.
        if (isRegistration && personId && email) {
          try {
            const sb2 = getSupabase();
            const { data: ourContact } = await sb2.from('contacts')
              .select('id').eq('fub_id', personId).maybeSingle();
            if (ourContact?.id && userType) {
              await sb2.from('contacts').update({ client_type: String(userType).trim() }).eq('id', ourContact.id);
            }
            const { data: regNow } = await sb2.from('registrations')
              .select('user_id').ilike('email', email).maybeSingle();
            if (ourContact?.id && regNow?.user_id) {
              await sb2.from('site_events').update({ contact_id: ourContact.id }).eq('user_id', regNow.user_id).is('contact_id', null);
              const { data: ses } = await sb2.from('site_events').select('session_id').eq('user_id', regNow.user_id).not('session_id', 'is', null).limit(50);
              const sids = Array.from(new Set((ses ?? []).map((r: any) => r.session_id).filter(Boolean)));
              if (sids.length > 0) {
                await sb2.from('site_events').update({ contact_id: ourContact.id }).in('session_id', sids).is('contact_id', null);
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
