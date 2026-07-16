import crypto from "node:crypto";

/**
 * Cryptographic primitives for authorization tokens.
 * Shared by sid sessions and magic-link one-time tokens: the client always receives the raw secret,
 * while only the sha256 hash is stored in the DB — a compromised DB dump yields no valid tokens.
 */

/** Random URL-safe secret. 48 bytes ≈ 64 base64url characters. */
export function generateToken(bytes = 48): string {
    return crypto.randomBytes(bytes).toString("base64url");
}

/** Token hash for storage/comparison. hex sha256 (64 chars) fits into varchar(128)/varchar(255). */
export function sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
}
