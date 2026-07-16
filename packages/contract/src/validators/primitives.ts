// Reusable Zod primitives. Part of the DTO/validation layer: they depend only on zod, so any
// consumer (core/db/auth) imports them without pulling in server dependencies.
//
// Purpose — remove validation duplication in DTOs. Instead of writing
// `@DtoProperty({validation: z.string().uuid()})` in every DTO, the consumer writes `@DtoProperty({validation: Uuid})`.
// An explicit options.validation takes precedence over inference from design:type (see generatePrimitiveZodValidation),
// so the primitives are embedded "as is".
//
// All "query-friendly" primitives use z.coerce, because values coming from a querystring/path always
// arrive as strings — otherwise a number/date from ?lat=55.7 would not pass validation.
import {z} from "zod";

// ── Identifiers ─────────────────────────────────────────────────────────────────────
/** UUID of any version (RFC 9562/4122). */
export const Uuid = z.uuid();

// ── Geo coordinates ───────────────────────────────────────────────────────────────────
// Ranges per WGS84. coerce — so that coordinates arrive from query/path as strings.
/** Latitude: −90..90. */
export const Latitude = z.coerce.number().min(-90).max(90);
/** Longitude: −180..180. */
export const Longitude = z.coerce.number().min(-180).max(180);

// ── Date/time ─────────────────────────────────────────────────────────────────────────
/** An ISO-8601 datetime string (offset allowed): "2026-06-17T12:00:00Z". Stays a string. */
export const IsoDateTime = z.iso.datetime({offset: true});
/** ISO datetime → Date. Convenient for @DtoProperty when a Date object is exactly what is needed. */
export const IsoDateTimeAsDate = z.coerce.date();

// ── Other string formats ───────────────────────────────────────────────────────────────
/** E-mail. */
export const Email = z.email();

// ── Boolean from query/json ─────────────────────────────────────────────────────────────
// We reuse the existing boolFromQueryOrJson (the issue explicitly asks to "keep and reuse" it):
// "true"/"1"/"yes"/"on" → true, "false"/"0"/"no"/"off"/"" → false, plus native boolean/number.
export {boolFromQueryOrJson} from "./validation.js";
import {boolFromQueryOrJson} from "./validation.js";
/** A boolean tolerant of string/numeric representations from a query or JSON. */
export const StringBool = boolFromQueryOrJson();

// ── Coerce helpers ──────────────────────────────────────────────────────────────────────
// Thin wrappers over z.coerce for consistency and readability in DTOs. Built as factories,
// so that each call yields a fresh schema (you can then chain .min()/.optional() without sharing).
/** number from a string/number (?limit=10 → 10). */
export const coerceNumber = () => z.coerce.number();
/** integer from a string/number. */
export const coerceInt = () => z.coerce.number().int();
/** Date from a string/number/Date. */
export const coerceDate = () => z.coerce.date();
/** bigint from a string/number (for bigint ids). */
export const coerceBigInt = () => z.coerce.bigint();
