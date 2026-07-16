// issue #8 — boundaries of reusable zod primitives: geo ranges, UUID/date format, email,
// stringbool, coerce. The oracle is runtime parsing of the zod schemas.
import {describe, test, expect} from "vitest";
import {
    Uuid,
    Latitude,
    Longitude,
    IsoDateTime,
    IsoDateTimeAsDate,
    Email,
    StringBool,
    coerceNumber,
    coerceInt,
    coerceDate,
    coerceBigInt,
} from "../src/index.js";

describe("Uuid", () => {
    test("accepts a valid UUID", () => {
        expect(Uuid.parse("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
    });
    test("rejects garbage", () => {
        expect(Uuid.safeParse("not-a-uuid").success).toBe(false);
        expect(Uuid.safeParse("123e4567e89b12d3a456426614174000").success).toBe(false);
    });
});

describe("Latitude / Longitude (WGS84 ranges)", () => {
    test("latitude bounds −90..90 inclusive", () => {
        expect(Latitude.parse(-90)).toBe(-90);
        expect(Latitude.parse(90)).toBe(90);
        expect(Latitude.parse(55.75)).toBe(55.75);
    });
    test("latitude out of range is rejected", () => {
        expect(Latitude.safeParse(90.0001).success).toBe(false);
        expect(Latitude.safeParse(-90.1).success).toBe(false);
    });
    test("longitude bounds −180..180 inclusive", () => {
        expect(Longitude.parse(-180)).toBe(-180);
        expect(Longitude.parse(180)).toBe(180);
    });
    test("longitude out of range is rejected", () => {
        expect(Longitude.safeParse(180.5).success).toBe(false);
        expect(Longitude.safeParse(-181).success).toBe(false);
    });
    test("coerce: a coordinate from a query string is converted to a number", () => {
        expect(Latitude.parse("55.75")).toBe(55.75);
        expect(Longitude.parse("37.61")).toBe(37.61);
    });
});

describe("IsoDateTime", () => {
    test("accepts ISO-8601 with offset/Z and keeps it as a string", () => {
        expect(IsoDateTime.parse("2026-06-17T12:00:00Z")).toBe("2026-06-17T12:00:00Z");
        expect(IsoDateTime.parse("2026-06-17T12:00:00+03:00")).toBe("2026-06-17T12:00:00+03:00");
    });
    test("rejects non-ISO strings", () => {
        expect(IsoDateTime.safeParse("17.06.2026").success).toBe(false);
        expect(IsoDateTime.safeParse("2026-06-17").success).toBe(false);
    });
    test("IsoDateTimeAsDate → Date object", () => {
        const d = IsoDateTimeAsDate.parse("2026-06-17T12:00:00Z");
        expect(d).toBeInstanceOf(Date);
        expect(d.getUTCFullYear()).toBe(2026);
    });
});

describe("Email", () => {
    test("valid/invalid", () => {
        expect(Email.parse("a@b.co")).toBe("a@b.co");
        expect(Email.safeParse("nope").success).toBe(false);
    });
});

describe("StringBool", () => {
    test.each([
        ["true", true], ["1", true], ["yes", true], ["on", true],
        ["false", false], ["0", false], ["no", false], ["off", false], ["", false],
    ])("string %s → %s", (input, expected) => {
        expect(StringBool.parse(input)).toBe(expected);
    });
    test("native boolean/number", () => {
        expect(StringBool.parse(true)).toBe(true);
        expect(StringBool.parse(1)).toBe(true);
        expect(StringBool.parse(0)).toBe(false);
    });
});

describe("coerce helpers (a fresh schema on every call)", () => {
    test("coerceNumber/coerceInt", () => {
        expect(coerceNumber().parse("10.5")).toBe(10.5);
        expect(coerceInt().parse("10")).toBe(10);
        expect(coerceInt().safeParse("10.5").success).toBe(false);
    });
    test("coerceDate/coerceBigInt", () => {
        expect(coerceDate().parse("2026-06-17T00:00:00Z")).toBeInstanceOf(Date);
        expect(coerceBigInt().parse("42")).toBe(42n);
    });
    test("factories do not share a schema instance", () => {
        expect(coerceNumber()).not.toBe(coerceNumber());
    });
});
