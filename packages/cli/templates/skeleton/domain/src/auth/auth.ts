import type {Request, Response} from "express";

import {SessionService} from "@injitools/auth";
import {RequestError} from "@injitools/core";

import {dbMain} from "../db/dataSource.js";
import UserOrm from "../db/entities/UserOrm.js";

const COOKIE_NAME = "sid";
// Secure cookie only over HTTPS. For http-localhost keep COOKIE_SECURE=false.
const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? "false") === "true";

// Cookie session service. hashTokens:true — the DB stores sha256(sid), the client receives the raw sid.
export const sessions = new SessionService(dbMain, {
    cookieName: COOKIE_NAME,
    hashTokens: true,
    onTouch: async (session) => {
        await dbMain.manager.update(UserOrm, {id: session.user_id} as any, {last_seen: new Date()} as any);
    },
});

const cookieBase = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: COOKIE_SECURE,
    path: "/",
};

/** Creates a session and sets the sid cookie on the Express response. */
export async function startSession(res: Response, userId: bigint): Promise<void> {
    const {sid} = await sessions.createSession(userId);
    res.cookie(COOKIE_NAME, sid, {...cookieBase, maxAge: sessions.defaultTtlMs});
}

/** Tears down the session and removes the cookie. */
export async function endSession(req: Request, res: Response): Promise<void> {
    const sid = req.cookies?.[COOKIE_NAME];
    if (sid) await sessions.destroySession(sid);
    res.clearCookie(COOKIE_NAME, cookieBase);
}

/** The current user from the cookie session, or null. */
export async function currentUser(req: Request): Promise<UserOrm | null> {
    const sid = req.cookies?.[COOKIE_NAME];
    if (!sid) return null;
    const session = await sessions.getSession(sid);
    if (!session) return null;
    return dbMain.manager.findOneBy(UserOrm, {id: session.user_id} as any);
}

/** Requires a logged-in user, otherwise 401. */
export async function requireUser(req: Request): Promise<UserOrm> {
    const user = await currentUser(req);
    if (!user) throw new RequestError(401, "Authentication required", "Unauthorized");
    return user;
}

/** Requires the admin role, otherwise 403. */
export async function requireAdmin(req: Request): Promise<UserOrm> {
    const user = await requireUser(req);
    if (user.role !== "admin") throw new RequestError(403, "Administrator access only", "Forbidden");
    return user;
}
