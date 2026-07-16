import "reflect-metadata";
import {describe, test, expect} from "vitest";
import type {DataSource} from "typeorm";

import {SessionService, MagicLinkService, LoginTokenOrm, AuthError, sha256} from "@injitools/auth";
import {fakeDataSource} from "./fake-manager.js";
import {UuidUserSessionOrm, UuidLoginTokenOrm} from "./fixtures/uuid-entities.js";

function setup() {
    const db = fakeDataSource();
    const sessions = new SessionService(db as unknown as DataSource);
    const magic = new MagicLinkService(db as unknown as DataSource, sessions);
    return {db, sessions, magic};
}

describe("MagicLinkService (issue #5)", () => {
    test("requestLogin: the DB holds only sha256(token), the raw token is returned to the client", async () => {
        const {db, magic} = setup();
        const {token, expiresAt} = await magic.requestLogin(42n);
        expect(typeof token).toBe("string");
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

        const row = db.manager.dump(LoginTokenOrm)[0];
        expect(row.token_hash).toBe(sha256(token));
        expect(row.token_hash).not.toBe(token); // the raw token is not in the DB
        expect(row.consumed_at).toBeNull();
    });

    test("verifyLogin: a successful verification consumes the token and creates a working session", async () => {
        const {magic, sessions} = setup();
        const {token} = await magic.requestLogin(42n);

        const res = await magic.verifyLogin(token);
        expect(String(res.userId)).toBe("42");
        expect(typeof res.sid).toBe("string");
        expect(res.cookie).toContain("sid=");

        // The session is actually created and validates.
        const sess = await sessions.getSession(res.sid);
        expect(sess).not.toBeNull();
        expect(String(sess!.user_id)).toBe("42");
    });

    test("single-use: re-verifying the same token is rejected", async () => {
        const {magic} = setup();
        const {token} = await magic.requestLogin(42n);
        await magic.verifyLogin(token); // first time — ok

        await expect(magic.verifyLogin(token)).rejects.toBeInstanceOf(AuthError);
    });

    test("an expired token is rejected", async () => {
        const {magic} = setup();
        const {token} = await magic.requestLogin(42n, {ttlMs: -1000});
        await expect(magic.verifyLogin(token)).rejects.toThrow(/expired/i);
    });

    test("an invalid token is rejected", async () => {
        const {magic} = setup();
        await expect(magic.verifyLogin("not-a-real-token")).rejects.toThrow(/invalid/i);
    });

    test("UUID identity (issue #6 together with #5): token and session on user_id: string", async () => {
        const db = fakeDataSource();
        const sessions = new SessionService<string>(db as unknown as DataSource, {
            sessionEntity: UuidUserSessionOrm,
            hashTokens: true,
        });
        const magic = new MagicLinkService<string>(db as unknown as DataSource, sessions, {
            tokenEntity: UuidLoginTokenOrm,
        });
        const uid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

        const {token} = await magic.requestLogin(uid);
        const res = await magic.verifyLogin(token);
        expect(res.userId).toBe(uid);

        const sess = await sessions.getSession(res.sid);
        expect(sess!.user_id).toBe(uid);
        // The session sid is stored by hash (inherits hashTokens from the session service).
        expect(db.manager.dump(UuidUserSessionOrm)[0].sid).toBe(sha256(res.sid));
    });
});
