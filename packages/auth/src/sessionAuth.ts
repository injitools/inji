import type {Request, Response} from "express";

import {Middleware, createMiddleware, ErrorResponseDto, RequestError} from "@injitools/core";

import SessionService from "./SessionService.js";

/**
 * Cookie-session auth for an application subject — the session plumbing AND the guard, in one place,
 * instead of copied into every scaffold's `domain/src/auth`.
 *
 * It is parameterized, not hard-wired: you pass the SessionService, a loader for your own subject
 * (a user row, a client account — the framework has no user entity), and, if the subject has roles,
 * a role accessor. So the SAME factory serves an admin (cookie `sid`, roles) and a client cabinet
 * (cookie `csid`, no roles, a different `req.meta` key) — call it twice with different options.
 */
export type SessionAuthOptions<TUser, TUserId = bigint> = {
    /** The configured session service (cookie name, hashing, ttl live there). */
    sessions: SessionService<TUserId>;
    /** Load the subject by its session user_id. Null → the row is gone, treat as logged out. */
    loadUser: (userId: TUserId) => Promise<TUser | null>;
    /** Role of a subject, for `RequireRole(...roles)`. Omit for a subject without roles. */
    roleOf?: (user: TUser) => string | null | undefined;
    /** Cookie name. Defaults to the SessionService's own. */
    cookieName?: string;
    /** OpenAPI security-scheme name the guard advertises. Default "cookieAuth". */
    securityScheme?: string;
    /** `req.meta` key the guard fills (read via `@Meta(...)`). Default "user". */
    metaKey?: string;
    /** Cookie flags for start/endSession. secure defaults to false (http-localhost dev). */
    cookie?: {secure?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string};
};

export function createSessionAuth<TUser, TUserId = bigint>(opts: SessionAuthOptions<TUser, TUserId>) {
    const cookieName = opts.cookieName ?? opts.sessions.defaultCookieName;
    const metaKey = opts.metaKey ?? "user";
    const schemeName = opts.securityScheme ?? "cookieAuth";
    const cookieBase = {
        httpOnly: true,
        sameSite: (opts.cookie?.sameSite ?? "lax") as "lax" | "strict" | "none",
        secure: opts.cookie?.secure ?? false,
        path: opts.cookie?.path ?? "/",
    };
    // OpenAPI: the subject is proven by a session cookie. `as any` only to avoid dragging the
    // zod-openapi types into this package's public surface — the shape is the documented one.
    const cookieScheme = {type: "apiKey", in: "cookie", name: cookieName} as any;

    async function startSession(res: Response, userId: TUserId, data?: Record<string, any> | null): Promise<void> {
        const {sid} = await opts.sessions.createSession(userId, data ?? null);
        res.cookie(cookieName, sid, {...cookieBase, maxAge: opts.sessions.defaultTtlMs});
    }

    async function endSession(req: Request, res: Response): Promise<void> {
        const sid = req.cookies?.[cookieName];
        if (sid) await opts.sessions.destroySession(sid);
        res.clearCookie(cookieName, cookieBase);
    }

    async function currentUser(req: Request): Promise<TUser | null> {
        const sid = req.cookies?.[cookieName];
        if (!sid) return null;
        const session = await opts.sessions.getSession(sid);
        if (!session) return null;
        return opts.loadUser(session.user_id);
    }

    async function requireUser(req: Request): Promise<TUser> {
        const user = await currentUser(req);
        if (!user) throw new RequestError(401, "Authentication required", "Unauthorized");
        return user;
    }

    /**
     * Guard: requires a logged-in subject, and — if roles are given — one of those roles. Puts the
     * subject into `req.meta[metaKey]`, and contributes the cookie security scheme + 401 (and 403
     * when it checks a role) to OpenAPI. `RequireRole()` ≡ "any logged-in subject".
     */
    function RequireRole(...roles: string[]): MethodDecorator {
        const checksRole = roles.length > 0;
        const handler = async (req: any, _res: any, next: (err?: unknown) => void) => {
            try {
                const user = await requireUser(req);
                if (checksRole) {
                    const role = opts.roleOf?.(user) ?? undefined;
                    if (!role || !roles.includes(role)) {
                        throw new RequestError(403, "Insufficient permissions", "Forbidden");
                    }
                }
                req.meta = req.meta || {};
                req.meta[metaKey] = user;
                next();
            } catch (e) {
                next(e);
            }
        };
        const responses = checksRole
            ? [
                  {code: 401 as const, description: "Unauthorized", type: ErrorResponseDto},
                  {code: 403 as const, description: "Forbidden", type: ErrorResponseDto},
              ]
            : [{code: 401 as const, description: "Unauthorized", type: ErrorResponseDto}];
        const mw = createMiddleware(handler).security(schemeName, cookieScheme).responses(...responses);
        return Middleware(mw);
    }

    return {startSession, endSession, currentUser, requireUser, RequireRole};
}
