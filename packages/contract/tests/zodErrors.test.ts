// issue #4 — parsing a ZodError into {formErrors, fieldErrors} for highlighting form fields.
import {describe, test, expect} from "vitest";
import {z} from "zod";
import {flattenZodIssues, isValidationErrorPayload} from "../src/index.js";

const schema = z.strictObject({
    email: z.email(),
    age: z.number().int().min(0),
});

describe("flattenZodIssues", () => {
    test("field errors are grouped by the top-level field name", () => {
        const res = schema.safeParse({email: "nope", age: -1});
        expect(res.success).toBe(false);
        const flat = flattenZodIssues(res.error!.issues);
        expect(Object.keys(flat.fieldErrors).sort()).toEqual(["age", "email"]);
        expect(flat.fieldErrors.email.length).toBeGreaterThan(0);
        expect(flat.fieldErrors.age.length).toBeGreaterThan(0);
    });

    test("a form-level error (extra key in strictObject) lands in formErrors", () => {
        const res = schema.safeParse({email: "a@b.co", age: 1, extra: 1});
        const flat = flattenZodIssues(res.error!.issues);
        expect(flat.formErrors.length).toBeGreaterThan(0);
    });

    test("a nested error is aggregated onto the top-level field", () => {
        const nested = z.object({address: z.object({zip: z.string().min(3)})});
        const res = nested.safeParse({address: {zip: "1"}});
        const flat = flattenZodIssues(res.error!.issues);
        expect(flat.fieldErrors.address?.length).toBeGreaterThan(0);
    });

    test("valid input → empty formErrors/fieldErrors", () => {
        expect(flattenZodIssues([])).toEqual({formErrors: [], fieldErrors: {}});
    });
});

describe("isValidationErrorPayload", () => {
    test("recognizes a valid payload", () => {
        expect(isValidationErrorPayload({formErrors: [], fieldErrors: {}})).toBe(true);
    });
    test("rejects everything else", () => {
        expect(isValidationErrorPayload(null)).toBe(false);
        expect(isValidationErrorPayload({formErrors: "x"})).toBe(false);
        expect(isValidationErrorPayload(42)).toBe(false);
    });
});
