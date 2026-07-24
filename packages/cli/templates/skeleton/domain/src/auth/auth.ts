import {SessionService, createSessionAuth} from "@injitools/auth";

import {dbMain} from "../db/dataSource.js";
import UserOrm from "../db/entities/UserOrm.js";

// Cookie-session auth for this app's users. The plumbing — sessions, cookie helpers, the RequireRole
// guard — lives in @injitools/auth; here we only wire OUR subject to it: how to load a user and
// where its role is. Everything below is configuration, not a reimplementation.

// Secure cookie only over HTTPS. For http-localhost keep COOKIE_SECURE=false.
const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? "false") === "true";

// hashTokens:true — the DB stores sha256(sid), the client receives the raw sid.
export const sessions = new SessionService<bigint>(dbMain, {
    cookieName: "sid",
    hashTokens: true,
    onTouch: async (session) => {
        await dbMain.manager.update(UserOrm, {id: session.user_id} as any, {last_seen: new Date()} as any);
    },
});

const auth = createSessionAuth<UserOrm, bigint>({
    sessions,
    loadUser: (id) => dbMain.manager.findOneBy(UserOrm, {id} as any),
    roleOf: (user) => user.role,
    cookie: {secure: COOKIE_SECURE},
});

// Cookie helpers + the guard. Use @RequireRole() for "any logged-in user" and
// @RequireRole("admin") for an admin-only endpoint.
export const {startSession, endSession, currentUser, requireUser, RequireRole} = auth;
