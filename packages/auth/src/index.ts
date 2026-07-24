// @injitools/auth — ready-made authorization for Inji.

// ── Entities (add them to the entities of your DataSource) ─────────────────────
// Built-ins use PORTABLE column types (no timestamptz/jsonb/bigint-unsigned), so the same entity
// works on MySQL and postgres — declare your own only to change an id TYPE (uuid vs bigint).
export {default as UserSessionOrm} from "./entities/UserSessionOrm.js";
export {default as ApiKeyOrm} from "./entities/ApiKeyOrm.js";
export {default as LoginTokenOrm} from "./entities/LoginTokenOrm.js";
export {default as LoginAttemptOrm} from "./entities/LoginAttemptOrm.js";
export {default as RateLimitOrm} from "./entities/RateLimitOrm.js";

// ── Session service ──────────────────────────────────────────────────────────────
export {default as SessionService} from "./SessionService.js";
export type {
    SessionServiceOptions,
    CreateSessionOptions,
    CookieSameSite,
    SessionRecord,
} from "./SessionService.js";

// ── Login throttle (append-and-count) ────────────────────────────────────────────
// Brute-force protection for sign-in. Each attempt is one appended row (never a counter to upsert
// and race on); an account or an IP is blocked when its failures over the window reach the cap. The
// same rows are the "recent sign-ins on your account" a UI can show the user.
export {default as LoginThrottle} from "./LoginThrottle.js";
export type {LoginAttemptRecord, LoginAttemptInput, LoginThrottleOptions} from "./LoginThrottle.js";

// ── Generic rate-limit guard ─────────────────────────────────────────────────────
// `@RateLimit({bucket, limit, windowMs})` for arbitrary endpoints (register, password reset).
// Append-and-count like the throttle; bind it to your DataSource with createRateLimit.
export {createRateLimit} from "./rateLimit.js";
export type {RateLimitHit, RateLimitGuardOptions, RateLimitFactoryOptions} from "./rateLimit.js";

// ── Password hashing (scrypt) ────────────────────────────────────────────────────
export {hashPassword, verifyPassword} from "./password.js";

// ── Cookie-session auth + role guard ─────────────────────────────────────────────
// Session plumbing (start/end/current/require) and a single `RequireRole(...)` guard, parameterized
// by your own subject and SessionService — call it once per subject (admin, client cabinet, …).
export {createSessionAuth} from "./sessionAuth.js";
export type {SessionAuthOptions} from "./sessionAuth.js";

// ── Magic-link / one-time tokens ───────────────────────────────────────
export {default as MagicLinkService} from "./MagicLinkService.js";
export type {
    MagicLinkOptions,
    VerifyLoginResult,
    LoginTokenRecord,
} from "./MagicLinkService.js";

// ── Tokens (shared crypto primitives) ────────────────────────────────────────────
export {generateToken, sha256} from "./tokens.js";

// ── Middleware factories ─────────────────────────────────────────────────────────
export {default as createBearerAuth} from "./middleware/bearerAuth.js";
export type {BearerAuthOptions} from "./middleware/bearerAuth.js";
export {default as createCookieAuth} from "./middleware/cookieAuth.js";
export type {CookieAuthOptions} from "./middleware/cookieAuth.js";

// ── Parameter decorators ─────────────────────────────────────────────────────────
export {default as User} from "./decorators/User.js";
export {default as Session} from "./decorators/Session.js";

// ── Errors ───────────────────────────────────────────────────────────────────────
export {AuthError} from "./errors/AuthError.js";
