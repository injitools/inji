import "reflect-metadata";
import {describe, test, expect} from "vitest";
import type {DataSource} from "typeorm";

import {createRateLimit} from "@injitools/auth";
import {fakeDataSource} from "./fake-manager.js";

class Hit {}

function clock(start = 0) {
    let t = start;
    return {now: () => new Date(t), advance: (ms: number) => (t += ms)};
}

function setup() {
    const db = fakeDataSource();
    const c = clock();
    const {hit, reset} = createRateLimit(db as unknown as DataSource, {hitEntity: Hit as never, now: c.now});
    return {hit, reset, c};
}

describe("createRateLimit — generic fixed-window guard", () => {
    test("allows up to the limit, then blocks; the window resets it", async () => {
        const {hit, c} = setup();
        expect(await hit("register", "ip1", 2, 1000)).toBe(true);
        expect(await hit("register", "ip1", 2, 1000)).toBe(true);
        expect(await hit("register", "ip1", 2, 1000)).toBe(false); // third within window
        c.advance(1001);
        expect(await hit("register", "ip1", 2, 1000)).toBe(true); // window rolled over
    });

    test("buckets and ips count independently", async () => {
        const {hit} = setup();
        expect(await hit("register", "ip1", 1, 1000)).toBe(true);
        expect(await hit("register", "ip1", 1, 1000)).toBe(false);
        expect(await hit("register", "ip2", 1, 1000)).toBe(true); // other ip
        expect(await hit("login", "ip1", 1, 1000)).toBe(true); // other bucket
    });

    test("reset clears a bucket", async () => {
        const {hit, reset} = setup();
        await hit("register", "ip1", 1, 1000);
        expect(await reset("register")).toBe(1);
        expect(await hit("register", "ip1", 1, 1000)).toBe(true);
    });
});
