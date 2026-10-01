declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** HubSpot private app token (server-only). Set in .dev.vars locally, as a secret in production. */
    HUBSPOT_ACCESS_TOKEN?: string;
    /** Optional override of https://api.hubapi.com, for tests. */
    HUBSPOT_API_BASE?: string;
    /** Comma-separated HubSpot owner IDs that receive seller-response tasks (default: both Khadija Hesham owners). */
    HUBSPOT_TASK_OWNER_IDS?: string;
    /** Team admin password for /admin (min. 12 characters). */
    ADMIN_PASSWORD?: string;
    /** Optional secret for signing admin sessions (defaults to one derived from the password and HubSpot key). */
    ADMIN_SESSION_SECRET?: string;
    /** Optional salt for the anonymised public request IDs. */
    WISHLIST_ID_SALT?: string;
  }
}
