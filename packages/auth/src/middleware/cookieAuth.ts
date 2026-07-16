import {Middleware, createMiddleware, ErrorResponseDto} from "@injitools/core";

import SessionService from "../SessionService.js";
import {AuthError} from "../errors/AuthError.js";

export type CookieAuthOptions<User = any, TUserId = bigint> = {
    sessions: SessionService<TUserId>
    /** Loads the user by the session's user_id (the key type is parameterized). */
    loadUser: (userId: TUserId) => Promise<User | null>
    /** Cookie name. Defaults to sessions.defaultCookieName. */
    cookieName?: string
}

/**
 * Factory for a cookie-session authorization method decorator. Puts session and user
 * into req.meta and registers the `cookieAuth` security scheme in OpenAPI.
 * Requires a cookie-parser to be wired into the application.
 */
export default function createCookieAuth<User = any, TUserId = bigint>(options: CookieAuthOptions<User, TUserId>) {
    const cookieName = options.cookieName ?? options.sessions.defaultCookieName

    return function CookieAuth(): MethodDecorator {
        const handler = async (req: any, _res: any, next: Function) => {
            try {
                const sid = req.cookies?.[cookieName]
                if (!sid) throw new AuthError("Not authorized")

                const session = await options.sessions.getSession(sid)
                if (!session) throw new AuthError("Not authorized")

                const user = await options.loadUser(session.user_id)
                if (!user) throw new AuthError("User not found")

                req.meta = req.meta || {}
                req.meta.session = session
                req.meta.user = user

                next()
            } catch (e) {
                next(e)
            }
        }

        const mw = createMiddleware(handler)
            .security('cookieAuth', {type: 'apiKey', in: 'cookie', name: cookieName})
            .responses({code: 401, description: 'Unauthorized', type: ErrorResponseDto})

        return Middleware(mw)
    }
}
