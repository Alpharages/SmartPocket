export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

/**
 * SP-082: the category-name field had no client-side cap, so a 300-character
 * name was accepted by the input and rejected only by the server — surfacing
 * as a generic "Failed to add category". Mirrors `categorySchema`'s `max(100)`
 * in server/routers.ts so both ends agree on the limit.
 */
export const CATEGORY_NAME_MAX_LENGTH = 100;
