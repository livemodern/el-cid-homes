#!/usr/bin/env node
/**
 * Build gate: every hand-maintained slug -> domain map in this repo must match
 * the Supabase `sites` table.
 *
 * WHY THIS EXISTS (Patrick 2026-08-21)
 * ------------------------------------
 * The slug -> domain mapping had drifted into four hand-maintained copies in
 * mlg-admin. The lead-routing email's copy knew four of fourteen sites and
 * ended in a bare `return 'modernlivingre.com'`, so nine mini-sites spent
 * months telling agents the wrong website — 117 leads. Nothing failed; an
 * unmapped slug produced a plausible, WRONG answer.
 *
 * mlg-admin got a gate the same day. This is that gate, generalised so the
 * other repos in the fleet get the same lock — because the copies did not stop
 * at mlg-admin:
 *   mlg-site/src/lib/lead-utils.ts   SOURCE_MAP     knew 3 of 14
 *   livemodern-site/app/account/…    SITE_META      13 entries, 2 wrong
 *
 * THIS FILE IS INTENTIONALLY IDENTICAL IN EVERY REPO.
 * Do not edit it per-repo. Everything repo-specific lives in
 * site-registry.config.json next to package.json. If this script itself
 * forked per repo it would become the fifth hand-maintained copy — the exact
 * bug it exists to prevent. To change behaviour, change it once and copy the
 * file verbatim to the others (`md5 scripts/check-site-registry.js` should
 * match across the fleet).
 *
 * Deliberate asymmetry between "wrong" and "can't tell":
 *   - a definite mismatch always fails, everywhere;
 *   - inability to check (no creds, network down) fails only on a Vercel
 *     PRODUCTION build, and warns locally. A missing service key must not stop
 *     someone building on a plane, but it must not let unverified mappings
 *     reach production either.
 *
 * Escape hatch: SKIP_SITE_REGISTRY_CHECK=1 skips entirely, so a Supabase
 * outage can never hold a deploy hostage. Opt-in and visible in the build log.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CONFIG = path.join(ROOT, 'site-registry.config.json')
const isVercelProd = process.env.VERCEL_ENV === 'production'

if (process.env.SKIP_SITE_REGISTRY_CHECK) {
  console.warn('\x1b[33m⚠ site-registry check skipped\x1b[0m via SKIP_SITE_REGISTRY_CHECK.')
  process.exit(0)
}

function bail(msg) {
  console.error(`\n\x1b[31m✖ site-registry check failed\x1b[0m\n${msg}\n`)
  process.exit(1)
}
function skip(msg) {
  if (isVercelProd) {
    bail(
      `${msg}\n\nThis is a Vercel production build, so an unverifiable registry is treated as a failure.\n` +
      `If Supabase is down and you need to ship, set SKIP_SITE_REGISTRY_CHECK=1 on the deploy.`,
    )
  }
  console.warn(`\x1b[33m⚠ site-registry check skipped:\x1b[0m ${msg}`)
  process.exit(0)
}

// ── Config ──────────────────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG)) bail(`No site-registry.config.json at repo root.\nThis script is config-driven; see the header.`)
let cfg
try { cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')) }
catch (e) { bail(`site-registry.config.json is not valid JSON: ${e.message}`) }

const maps = Array.isArray(cfg.maps) ? cfg.maps : []
if (!cfg.ownSlug && maps.length === 0) bail('site-registry.config.json declares neither ownSlug nor maps — nothing to check.')

/** Compare domains by host only: scheme, leading www., trailing slash and case
 *  are all irrelevant. www-vs-apex is a redirect concern, not a registry one —
 *  over-constraining it here would fail builds for a working canonical choice. */
const norm = d => String(d || '')
  .trim().toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/+$/, '')

// ── Parse each declared map out of the SOURCE, never by importing app code ──
// Importing would make this checker breakable by an unrelated bad import or a
// half-finished refactor, exactly when you most need it to run.
function parseMap(m) {
  const file = path.join(ROOT, m.file)
  if (!fs.existsSync(file)) bail(`site-registry.config.json points at ${m.file}, which does not exist.`)
  const src = fs.readFileSync(file, 'utf8')

  const declIdx = src.search(new RegExp(`(const|let|var)\\s+${m.const}\\b`))
  if (declIdx < 0) bail(`Could not find \`${m.const}\` in ${m.file}.\nIf it was renamed or moved, update site-registry.config.json.`)

  // Find the ASSIGNMENT `=`, not the first `{`. A typed declaration such as
  //   const SITE_META: Record<string, { label: string; origin: string }> = { … }
  // puts braces in the TYPE, and naively taking the first `{` parses the type
  // annotation instead of the value — which yields zero entries and, without
  // the zero-entry bail below, would silently pass forever.
  let eq = -1
  for (let i = declIdx, depth = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '{' || c === '[' || c === '(' || c === '<') depth++
    else if (c === '}' || c === ']' || c === ')' || c === '>') depth--
    else if (c === '=' && depth === 0 && src[i + 1] !== '=' && src[i + 1] !== '>' && !'=!<>'.includes(src[i - 1])) { eq = i; break }
    else if (c === '\n' && depth === 0 && eq < 0 && src.slice(declIdx, i).includes(';')) break
  }
  if (eq < 0) bail(`Found \`${m.const}\` in ${m.file} but no assignment after it.`)

  // Slice from the opening brace to its matching close, so a later object in
  // the same file can never bleed into the parse.
  const open = src.indexOf('{', eq)
  if (open < 0) bail(`Found \`${m.const}\` in ${m.file} but no object literal after it.`)
  let depth = 0, close = -1
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { close = i; break } }
  }
  if (close < 0) bail(`Unbalanced braces while reading \`${m.const}\` in ${m.file}.`)
  const body = src.slice(open, close + 1)

  const out = new Map()
  if (m.keyedBy === 'domain') {
    // Keys only. The VALUE may legitimately be null (e.g. a site with no
    // community page), and a value-shaped regex silently skips those keys —
    // which reads as "missing" and fails a perfectly good build. Match keys at
    // depth 1 regardless of what follows the colon.
    let depth = 0
    for (let i = 0; i < body.length; i++) {
      const c = body[i]
      if (c === '{' || c === '[' || c === '(') { depth++; continue }
      if (c === '}' || c === ']' || c === ')') { depth--; continue }
      if (depth !== 1) continue
      const rest = body.slice(i)
      const km = rest.match(/^(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$.-]+))\s*:/)
      if (km) { out.set(km[1] ?? km[2] ?? km[3], null); i += km[0].length - 1 }
    }
    if (out.size === 0) bail(`Parsed ZERO keys from \`${m.const}\` in ${m.file}.\nThe format changed and this check is no longer reading it.`)
    return out
  }
  if (m.valueField) {
    // slug: { …, <valueField>: 'https://domain' , … }
    const entry = /(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*:\s*\{([^{}]*)\}/g
    for (const mm of body.matchAll(entry)) {
      const slug = mm[1] ?? mm[2] ?? mm[3]
      const inner = mm[4]
      const fv = inner.match(new RegExp(`${m.valueField}\\s*:\\s*['"]([^'"]*)['"]`))
      if (fv) out.set(slug, fv[1])
    }
  } else {
    // slug: 'domain'
    const entry = /(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*:\s*'([^']*)'|(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*:\s*"([^"]*)"/g
    for (const mm of body.matchAll(entry)) {
      const slug = mm[1] ?? mm[2] ?? mm[3] ?? mm[5] ?? mm[6] ?? mm[7]
      const val = mm[4] ?? mm[8]
      if (slug != null && val != null) out.set(slug, val)
    }
  }
  if (out.size === 0) bail(`Parsed ZERO entries from \`${m.const}\` in ${m.file}.\nThe format changed and this check is no longer reading it — which is worse than no check, because it passes silently.`)
  return out
}

// ── Source of truth ─────────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
if (!url || !key) skip('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.')

// Three attempts. A single blip during a deploy should not be the difference
// between shipping and not shipping.
async function fetchSites(attempt = 1) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/sites?select=slug,domain,is_active`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctl.signal,
    })
    if (!r.ok) throw new Error(`sites query returned HTTP ${r.status}`)
    const rows = await r.json()
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('sites query returned no rows')
    return rows
  } catch (err) {
    if (attempt >= 3) throw err
    await new Promise(res => setTimeout(res, attempt * 1000))
    return fetchSites(attempt + 1)
  } finally {
    clearTimeout(timer)
  }
}

fetchSites()
  .then(rows => {
    // ACTIVE sites are REQUIRED in every map. Retired sites (is_active=false)
    // are OPTIONAL — historical leads still carry their slug, so a map may keep
    // them — but if present the domain must still be right. Requiring them
    // would force every retired site into every map forever.
    const all = new Map(), active = new Map()
    for (const r of rows) {
      const slug = String(r.slug ?? '').trim().toLowerCase()
      const domain = String(r.domain ?? '').trim().toLowerCase()
      if (!slug || !domain) continue
      all.set(slug, domain)
      if (r.is_active !== false) active.set(slug, domain)
    }
    const bySlug = active
    const problems = []

    // 1. This repo's own slug must be a registered site.
    if (cfg.ownSlug) {
      if (!bySlug.has(cfg.ownSlug.toLowerCase())) {
        problems.push(
          `This repo declares ownSlug '${cfg.ownSlug}', which is NOT in the \`sites\` table.\n` +
          `  Every row this app writes (leads, saved_listings, site_events, registrations)\n` +
          `  would be stamped with an orphan slug that no lookup can resolve.\n` +
          `  Registered slugs: ${[...bySlug.keys()].sort().join(', ')}`,
        )
      }
    }

    // 2. Every declared map must cover every registered site, with right domains.
    for (const m of maps) {
      const inFile = parseMap(m)
      const ignore = new Set((m.ignoreSlugs || []).map(s => s.toLowerCase()))
      const missing = []
      const mismatched = []

      // `keyedBy: "domain"` — the map is keyed by DOMAIN and its values are
      // something else entirely (e.g. SITE_TO_COMMUNITY_SLUG maps a site domain
      // to properties.community_slug, a different namespace that cannot be
      // derived from `sites`). Only the KEYS are checkable: every active site
      // must have an entry, even if the value is deliberately null.
      if (m.keyedBy === 'domain') {
        const keys = new Set([...inFile.keys()].map(norm))
        for (const [slug, domain] of bySlug) {
          if (ignore.has(slug)) continue
          if (!keys.has(norm(domain))) missing.push({ slug, domain, keyed: true })
        }
      } else {
      for (const [slug, domain] of bySlug) {
        if (ignore.has(slug)) continue
        const have = inFile.get(slug)
        if (have === undefined) missing.push({ slug, domain })
        else if (norm(have) !== norm(domain)) mismatched.push({ slug, domain, have })
      }
      }

      // A retired slug kept in the file is fine, but a WRONG domain on it is
      // not — historical rows still render through it.
      for (const [slug, have] of (m.keyedBy === 'domain' ? [] : inFile)) {
        const s = slug.toLowerCase()
        if (ignore.has(s) || bySlug.has(s)) continue
        const domain = all.get(s)
        if (domain && norm(have) !== norm(domain)) mismatched.push({ slug: s, domain, have, retired: true })
      }

      // Entries for slugs not in `sites` at all are NOT a failure — a site can
      // be deleted from the table while historical rows still carry its slug,
      // and those still have to render a domain rather than raw kebab-case.
      const extra = m.keyedBy === 'domain' ? [] : [...inFile.keys()].filter(s => !all.has(s.toLowerCase()))

      if (missing.length || mismatched.length) {
        const lines = [`\x1b[1m${m.file}\x1b[0m → \`${m.const}\``]
        if (missing.length) {
          lines.push('\n  Registered in `sites` but MISSING here:\n')
          const pad = Math.max(...missing.map(x => x.slug.length)) + 3
          for (const x of missing) {
            lines.push(x.keyed
              ? `      '${x.domain}':  <community_slug or null>,   // site '${x.slug}'`
              : m.valueField
                ? `      '${x.slug}':${' '.repeat(Math.max(1, pad - x.slug.length))}{ ${m.valueField}: 'https://${x.domain}' },`
                : `      '${x.slug}':${' '.repeat(Math.max(1, pad - x.slug.length))}'${x.domain}',`)
          }
        }
        if (mismatched.length) {
          lines.push('\n  Domain disagrees with `sites`:\n')
          for (const x of mismatched) lines.push(`      ${x.slug}: file has '${x.have}', sites says '${x.domain}'${x.retired ? '  (retired site — entry is optional, but must be correct if kept)' : ''}`)
        }
        if (extra.length) lines.push(`\n  (${extra.length} extra slug${extra.length > 1 ? 's' : ''} kept — not a failure: ${extra.join(', ')})`)
        problems.push(lines.join('\n'))
      }
    }

    if (problems.length) {
      bail(
        problems.join('\n\n') +
        '\n\nWhy this blocks the build: an unmapped slug does not render blank, it renders a\n' +
        'plausible WRONG domain. Nine sites did exactly that for 117 leads before anyone\n' +
        'noticed, because a wrong answer looks like a right one.',
      )
    }

    const parts = []
    if (cfg.ownSlug) parts.push(`ownSlug '${cfg.ownSlug}' registered`)
    if (maps.length) parts.push(`${maps.length} map${maps.length > 1 ? 's' : ''} match ${bySlug.size} sites`)
    console.log(`\x1b[32m✔ site-registry\x1b[0m ${parts.join('; ')}`)
    process.exit(0)
  })
  .catch(err => {
    skip(`could not reach Supabase after 3 attempts (${err.message}).`)
  })
