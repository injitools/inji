import {randomBytes, scryptSync, timingSafeEqual} from "node:crypto";

// Password hashing via scrypt (built into node, no native dependencies).
// Storage format: scrypt$<salt-hex>$<hash-hex>.

export function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const dk = scryptSync(password, salt, 64);
    return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const dk = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return dk.length === expected.length && timingSafeEqual(dk, expected);
}
