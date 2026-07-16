import "reflect-metadata";
import {describe, test, expect} from "vitest";
import type {DataSource} from "typeorm";

import {SessionService, UserSessionOrm, sha256} from "@injitools/auth";
import {fakeDataSource} from "./fake-manager.js";
import {UuidUserSessionOrm} from "./fixtures/uuid-entities.js";

describe("SessionService — default identity (bigint), back-compat", () => {
    test("createSession → getSession returns a session with user_id: bigint", async () => {
        const db = fakeDataSource();
        const svc = new SessionService(db as unknown as DataSource);
        const {sid, cookie} = await svc.createSession(123n, {role: "admin"});
        expect(typeof sid).toBe("string");
        expect(cookie).toContain("sid=");
        const sess = await svc.getSession(sid);
        expect(sess).not.toBeNull();
        expect(String(sess!.user_id)).toBe("123");
        expect(sess!.data).toEqual({role: "admin"});
    });

    test("without hashTokens the DB stores the raw sid (default preserved)", async () => {
        const db = fakeDataSource();
        const svc = new SessionService(db as unknown as DataSource);
        const {sid} = await svc.createSession(1n);
        expect(db.manager.dump(UserSessionOrm)[0].sid).toBe(sid);
    });

    test("destroySession removes it; an expired session is not returned and is purged", async () => {
        const db = fakeDataSource();
        const svc = new SessionService(db as unknown as DataSource);
        const {sid} = await svc.createSession(1n);
        await svc.destroySession(sid);
        expect(await svc.getSession(sid)).toBeNull();

        // TTL ≤ 0 → the session expires instantly.
        const expired = await svc.createSession(1n, null, {ttlMs: -1000});
        expect(await svc.getSession(expired.sid)).toBeNull();
        expect(db.manager.dump(UserSessionOrm).length).toBe(0); // the expired one is removed
    });
});

describe("SessionService — storing the sid by hash (issue #7)", () => {
    test("the DB has no raw sid (stores sha256), verification by the raw value works", async () => {
        const db = fakeDataSource();
        const svc = new SessionService(db as unknown as DataSource, {hashTokens: true});
        const {sid} = await svc.createSession(7n);

        const stored = db.manager.dump(UserSessionOrm)[0].sid;
        expect(stored).toBe(sha256(sid));
        expect(stored).not.toBe(sid); // the raw value is not in the DB

        // getSession by the RAW sid finds the record (it looks up by hash).
        const sess = await svc.getSession(sid);
        expect(sess).not.toBeNull();
        expect(String(sess!.user_id)).toBe("7");

        // A foreign/raw hash does not match.
        expect(await svc.getSession("garbage")).toBeNull();
    });
});

describe("SessionService — UUID identity (issue #6)", () => {
    test("a custom UUID entity plugs in without as any; user_id stays a string", async () => {
        const db = fakeDataSource();
        // The string type parameter + UUID entity — without type casts.
        const svc = new SessionService<string>(db as unknown as DataSource, {
            sessionEntity: UuidUserSessionOrm,
            hashTokens: true,
        });
        const uid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
        const {sid} = await svc.createSession(uid, {plan: "pro"});

        const sess = await svc.getSession(sid);
        expect(sess).not.toBeNull();
        expect(sess!.user_id).toBe(uid);
        expect(typeof sess!.user_id).toBe("string");

        // The record went into the custom table, not the default one.
        expect(db.manager.dump(UuidUserSessionOrm).length).toBe(1);
        expect(db.manager.dump(UserSessionOrm).length).toBe(0);
    });
});
