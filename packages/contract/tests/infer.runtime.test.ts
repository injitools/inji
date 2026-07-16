// Runtime check: the generated schema actually parses the INPUT shape into the OUTPUT shape exactly
// as Infer/InferInput promise. Type-level tests do not catch this (z.infer is derived from the
// same generator typing), so the correspondence between the types and Zod's actual behavior is
// covered here — including the optional seams ('?' ↔ {optional:true}) and primitive coercion.
import {describe, test, expect} from "vitest";
import {generateZodValidation, UrlLike} from "@injitools/contract";
import {PlaceDto} from "./fixtures/infer-app.js";

const fullInput = {
    title: "Cafe",
    site: "example.com/cafe", // string → UrlLike (https:// is prepended)
    openedAt: "2020-01-02",    // string → Date
    rating: "4.5",             // string → number
    verified: "yes",           // string → boolean
    visits: "1000",            // string → bigint
    tags: ["coffee", "wifi"],
    geo: {lat: 1, lon: 2},
    nearby: [{lat: 3, lon: 4}],
};

describe("generateZodValidation(PlaceDto) — behavior matches Infer/InferInput", () => {
    test("the INPUT shape is converted to the OUTPUT shape (coercing primitives, UrlLike from a string, nested links)", () => {
        const parsed: any = generateZodValidation(PlaceDto).parse(fullInput);

        expect(parsed.title).toBe("Cafe");
        expect(parsed.site).toBeInstanceOf(UrlLike);
        expect(parsed.site.clean).toBe("example.com/cafe");
        expect(parsed.openedAt).toBeInstanceOf(Date);
        expect(parsed.rating).toBe(4.5);
        expect(typeof parsed.rating).toBe("number");
        expect(parsed.verified).toBe(true);
        expect(parsed.visits).toBe(1000n);
        expect(typeof parsed.visits).toBe("bigint");
        expect(parsed.tags).toEqual(["coffee", "wifi"]);
        expect(parsed.geo.lat).toBe(1);
        expect(parsed.nearby[0].lon).toBe(4);
    });

    test("the optional field (note) can be omitted — '?' and {optional:true} are consistent", () => {
        const r = generateZodValidation(PlaceDto).safeParse(fullInput);
        expect(r.success).toBe(true);
    });

    test("strictObject rejects an extra field", () => {
        const r = generateZodValidation(PlaceDto).safeParse({...fullInput, extra: "nope"});
        expect(r.success).toBe(false);
    });
});
