import {describe, test, expect} from "vitest";

import {hashPassword, verifyPassword} from "@injitools/auth";

describe("password (scrypt)", () => {
    test("verifies a correct password and rejects a wrong one", () => {
        const stored = hashPassword("correct horse battery staple");
        expect(stored.startsWith("scrypt$")).toBe(true);
        expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
        expect(verifyPassword("Correct Horse Battery Staple", stored)).toBe(false);
    });

    test("each hash uses a fresh salt", () => {
        expect(hashPassword("same")).not.toBe(hashPassword("same"));
    });

    test("a malformed stored value is rejected, not thrown", () => {
        expect(verifyPassword("x", "")).toBe(false);
        expect(verifyPassword("x", "bcrypt$aa$bb")).toBe(false);
    });
});
