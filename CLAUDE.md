<!-- CANONICAL MEMORY POINTER — keep at the top of this file -->
# ⚠️ Read the shared memory first

Platform knowledge is **not** kept in this repo. It lives once, in
**`livemodern/mlg-admin` → `docs/memory/`**, so every repo and every session
shares the same notes.

| Need | Read |
|---|---|
| **Session start** | `mlg-admin` `docs/memory/INDEX.md` (~4KB, routing table) |
| **Before ANY db write, sync, backfill or migration** | `docs/memory/TRAPS.md` |
| A verified command | `docs/memory/RUNBOOK.md` |
| A settled decision | `docs/memory/DECISIONS.md` |
| Open TODOs / known bugs | `docs/memory/ROADMAP.md` |
| Designing something new | `docs/memory/REBUILD.md` |
| Architecture / infra / state | `docs/MLG_PLATFORM_MASTER.md` §1–§9 |

**Write new notes there, not here.** This is a mini-site: a clone of the CPST
template with content swapped — see `mlg-admin` `docs/MLG_MINISITE_BUILD_PLAYBOOK.md`.
`properties` is READ-ONLY here; all sync code lives in `twocityplazacondos`.

---

## This repo

Commit identity is always `Patrick Lafferty <patrick@modernlivingre.com>` —
Vercel blocks mismatches. A push is not done until the Vercel build is `READY`.
