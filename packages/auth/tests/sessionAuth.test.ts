import "reflect-metadata";
import {describe, test, expect} from "vitest";
import type {DataSource, Request, Response} from "typeorm";

import {SessionService, createSessionAuth} from "@injitools/auth";
import {fakeDataSource} from "./fake-manager.js";

class Session {}
type User = {id: bigint; role: string};

function setup(users: Record<string, User>) {
    const db = fakeDataSource();
    const sessions = new SessionService<bigint>(db as unknown as DataSource, {sessionEntity: Session as never});
    const auth = createSessionAuth<User, bigint>({
        sessions,
        cookieName: "sid",
        loadUser: async (id) => users[String(id)] ?? null,
        roleOf: (u) => u.role,
    });
    return {sessions, auth};
}

function reqWith(sid?: string): any {
    return {cookies: sid ? {sid} : {}};
}

describe("createSessionAuth", () => {
    test("currentUser resolves a live session to the subject, or null", async () => {
        const {sessions, auth} = setup({"1": {id: 1n, role: "admin"}});
        expect(await auth.currentUser(reqWith())).toBeNull();

        const {sid} = await sessions.createSession(1n);
        expect(await auth.currentUser(reqWith(sid))).toMatchObject({id: 1n, role: "admin"});
    });

    test("requireUser throws 401 without a session", async () => {
        const {auth} = setup({});
        await expect(auth.requireUser(reqWith())).rejects.toMatchObject({code: 401});
    });

    test("startSession sets a cookie; endSession clears it and kills the session", async () => {
        const {sessions, auth} = setup({"5": {id: 5n, role: "user"}});
        const set: Array<[string, string, any]> = [];
        const cleared: string[] = [];
        const res = {
            cookie: (n: string, v: string, o: any) => set.push([n, v, o]),
            clearCookie: (n: string) => cleared.push(n),
        } as unknown as Response;

        await auth.startSession(res, 5n);
        expect(set[0][0]).toBe("sid");
        const sid = set[0][1];
        expect(await auth.currentUser(reqWith(sid))).toMatchObject({id: 5n});

        await auth.endSession(reqWith(sid), res);
        expect(cleared).toContain("sid");
        expect(await auth.currentUser(reqWith(sid))).toBeNull(); // session destroyed
    });
});
