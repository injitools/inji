// The registries are process-wide, not module-wide. This is a security property, not a tidiness
// one: a guard is registered by a decorator (@RequireAdmin → @Middleware → RoutesStorage) and read
// by the router. If a duplicated copy of the framework split that registry, the guard would never
// reach the route and the endpoint would answer unauthorized callers with a 200 — silently.
import {test, expect, describe} from "vitest";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sharedSingleton, VERSION} from "@injitools/contract";

const testsDir = path.dirname(fileURLToPath(import.meta.url));

test("VERSION matches package.json (it cannot be read at runtime — no node builtins allowed here)", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(testsDir, "../package.json"), "utf8"));
    expect(VERSION).toBe(pkg.version);
});

describe("sharedSingleton", () => {
    test("a second copy of the SAME version reuses the first one's value", () => {
        const first = sharedSingleton("test.same", "1.0.0", () => new WeakMap<object, string>());
        const second = sharedSingleton("test.same", "1.0.0", () => new WeakMap<object, string>());
        expect(second).toBe(first);

        // The point of sharing: what one copy writes, the other one reads.
        const key = {};
        first.set(key, "written through the first copy");
        expect(second.get(key)).toBe("written through the first copy");
    });

    test("the creator only runs for the first copy", () => {
        let built = 0;
        const make = () => {
            built++;
            return {};
        };
        sharedSingleton("test.once", "1.0.0", make);
        sharedSingleton("test.once", "1.0.0", make);
        expect(built).toBe(1);
    });

    test("a copy of a DIFFERENT version throws instead of silently splitting the registry", () => {
        sharedSingleton("test.mismatch", "1.0.0", () => ({}));
        expect(() => sharedSingleton("test.mismatch", "2.0.0", () => ({}))).toThrow(
            /Two different versions of the Inji framework/,
        );
    });

    test("the error names both versions and how to find the duplicate", () => {
        sharedSingleton("test.message", "0.2.1", () => ({}));
        let message = "";
        try {
            sharedSingleton("test.message", "0.1.0", () => ({}));
        } catch (e) {
            message = (e as Error).message;
        }
        expect(message).toContain("0.2.1");
        expect(message).toContain("0.1.0");
        expect(message).toContain("npm ls");
    });

    test("the slot lives on globalThis, so separate module copies find it", () => {
        sharedSingleton("test.global", "1.0.0", () => "value");
        const slot = (globalThis as any)[Symbol.for("injitools.test.global")];
        expect(slot).toEqual({version: "1.0.0", value: "value"});
    });
});
