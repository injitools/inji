import "reflect-metadata";
import {describe, test, expect} from "vitest";
import type {DataSource} from "typeorm";

import {LoginThrottle} from "@injitools/auth";
import {fakeDataSource} from "./fake-manager.js";

class Attempt {}

function clock(start = 0) {
    let t = start;
    return {now: () => new Date(t), advance: (ms: number) => (t += ms)};
}

function setup(opts: {maxPerUser?: number; maxPerIp?: number; windowMs?: number} = {}) {
    const db = fakeDataSource();
    const c = clock();
    const throttle = new LoginThrottle<bigint>(db as unknown as DataSource, {
        attemptEntity: Attempt as never,
        windowMs: opts.windowMs ?? 1000,
        maxPerUser: opts.maxPerUser ?? 3,
        maxPerIp: opts.maxPerIp ?? 5,
        now: c.now,
    });
    return {throttle, c};
}

describe("LoginThrottle", () => {
    test("blocks an account after too many failures against it", async () => {
        const {throttle} = setup({maxPerUser: 3});
        for (let i = 0; i < 3; i++) await throttle.record({userId: 1n, ip: "a", success: false});
        expect(await throttle.retryAfter({userId: 1n, ip: "a"})).toBeGreaterThan(0);
        // A different account from the same ip is fine (only 3 ip-failures, cap is 5).
        expect(await throttle.retryAfter({userId: 2n, ip: "a"})).toBe(0);
    });

    test("blocks an ip that sprays many accounts, regardless of user_id", async () => {
        const {throttle} = setup({maxPerUser: 3, maxPerIp: 5});
        for (let i = 1; i <= 5; i++) await throttle.record({userId: BigInt(i), ip: "a", success: false});
        // No single account is over its cap, but the ip is → a fresh account from that ip is blocked.
        expect(await throttle.retryAfter({userId: 99n, ip: "a"})).toBeGreaterThan(0);
        // Another ip is untouched.
        expect(await throttle.retryAfter({userId: 99n, ip: "b"})).toBe(0);
    });

    test("only failures count; a success does not", async () => {
        const {throttle} = setup({maxPerUser: 3});
        await throttle.record({userId: 1n, ip: "a", success: false});
        await throttle.record({userId: 1n, ip: "a", success: true});
        await throttle.record({userId: 1n, ip: "a", success: false});
        expect(await throttle.retryAfter({userId: 1n, ip: "a"})).toBe(0); // 2 failures < 3
    });

    test("the block lifts as failures age out of the window", async () => {
        const {throttle, c} = setup({maxPerUser: 3, windowMs: 1000});
        for (let i = 0; i < 3; i++) await throttle.record({userId: 1n, ip: "a", success: false});
        expect(await throttle.retryAfter({userId: 1n, ip: "a"})).toBeGreaterThan(0);
        c.advance(1001);
        expect(await throttle.retryAfter({userId: 1n, ip: "a"})).toBe(0);
    });

    test("an unknown login (no user_id) is still caught by the ip cap", async () => {
        const {throttle} = setup({maxPerIp: 3});
        for (let i = 0; i < 3; i++) await throttle.record({userId: null, ip: "a", success: false});
        expect(await throttle.retryAfter({ip: "a"})).toBeGreaterThan(0);
    });

    test("history returns an account's attempts, newest first, successes included", async () => {
        const {throttle, c} = setup();
        await throttle.record({userId: 1n, ip: "a", success: false, userAgent: "one"});
        c.advance(10);
        await throttle.record({userId: 1n, ip: "a", success: true, userAgent: "two"});
        const rows = await throttle.history(1n);
        expect(rows.map((r) => r.user_agent)).toEqual(["two", "one"]);
        expect(rows.some((r) => r.success)).toBe(true);
    });

    test("blockedUsers lists over-cap accounts; clearUser frees one", async () => {
        const {throttle} = setup({maxPerUser: 2});
        for (let i = 0; i < 2; i++) await throttle.record({userId: 7n, ip: "a", success: false});
        expect([...(await throttle.blockedUsers()).keys()]).toEqual(["7"]);
        expect(await throttle.clearUser(7n)).toBe(2);
        expect(await throttle.retryAfter({userId: 7n, ip: "a"})).toBe(0);
    });
});
