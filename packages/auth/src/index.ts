// @injitools/auth — ready-made authorization for Inji.

// ── Entities (add them to the entities of your DataSource) ─────────────────────
export {default as UserSessionOrm} from "./entities/UserSessionOrm.js";
export {default as ApiKeyOrm} from "./entities/ApiKeyOrm.js";
export {default as LoginTokenOrm} from "./entities/LoginTokenOrm.js";

// ── Session service ──────────────────────────────────────────────────────────────
export {default as SessionService} from "./SessionService.js";
export type {
    SessionServiceOptions,
    CreateSessionOptions,
    CookieSameSite,
    SessionRecord,
} from "./SessionService.js";

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
