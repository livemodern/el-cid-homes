// ─── Building identity ────────────────────────────────────────────────────────
// The two facts this site needs in more than one place: the display name and
// the COMMUNITY slug. Centralised so the alert widgets, the grids and the
// listing page can't drift apart, and so cloning for the next building is a
// one-file edit.
//
// ALERT_FILTER is the saved-search location filter handed to BuildingAlerts. It
// is stored on saved_searches.location.filter and the alert cron matches
// properties on exactly these keys — so a key that is NULL in `properties`
// means the alert matches nothing and silently never fires. These keys were
// verified against the live table — building_name is NULL on every row here, so community_slug is the
// only key that can match.
export const BUILDING_NAME  = 'El Cid';
export const COMMUNITY_SLUG = 'el-cid-west-palm-beach';
export const ALERT_FILTER: Record<string, any> = { community_slug: COMMUNITY_SLUG };
export const ALERT_KIND = 'home';
export const ALERT_SOURCE = `community-alert:${{COMMUNITY_SLUG}}`;
