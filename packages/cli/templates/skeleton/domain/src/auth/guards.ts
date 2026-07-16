// Domain authorization guard decorators. Applied to a method as middleware:
// the check runs BEFORE the handler, puts the user into req.meta.user (read via
// @Meta("user")), and automatically adds the cookie-session security scheme (sid)
// and the 401/403 responses to OpenAPI.
//
// They live in domain because they are shared classes: the cookie session is common to
// both processes (client-api/admin-api), and a guard is a thin wrapper over
// requireUser/requireAdmin. Use @RequireUser()/@RequireAdmin() instead of an imperative
// await requireAdmin(req) in the method body: declarative, consistent, and immediately reflected in OpenAPI.

import {Middleware, createMiddleware, ErrorResponseDto} from "@injitools/core";
import type {ZodOpenApiSecuritySchemeObject} from "zod-openapi";

import {requireUser, requireAdmin} from "./auth.js";

// Cookie-session security scheme — matches COOKIE_NAME="sid" in auth.ts.
const COOKIE_SCHEME: ZodOpenApiSecuritySchemeObject = {type: "apiKey", in: "cookie", name: "sid"};

/** Guard: requires a logged-in user (otherwise 401). Puts it into req.meta.user (@Meta("user")). */
export function RequireUser(): MethodDecorator {
    const handler = async (req: any, _res: any, next: (err?: unknown) => void) => {
        try {
            req.meta = req.meta || {};
            req.meta.user = await requireUser(req);
            next();
        } catch (e) {
            next(e);
        }
    };
    const mw = createMiddleware(handler)
        .security("cookieAuth", COOKIE_SCHEME)
        .responses({code: 401, description: "Unauthorized", type: ErrorResponseDto});
    return Middleware(mw);
}

/** Guard: requires the admin role (otherwise 401 without a session / 403 without permissions). Puts the user into req.meta.user. */
export function RequireAdmin(): MethodDecorator {
    const handler = async (req: any, _res: any, next: (err?: unknown) => void) => {
        try {
            req.meta = req.meta || {};
            req.meta.user = await requireAdmin(req);
            next();
        } catch (e) {
            next(e);
        }
    };
    const mw = createMiddleware(handler)
        .security("cookieAuth", COOKIE_SCHEME)
        .responses(
            {code: 401, description: "Unauthorized", type: ErrorResponseDto},
            {code: 403, description: "Forbidden", type: ErrorResponseDto},
        );
    return Middleware(mw);
}
