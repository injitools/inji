// Type-level Infer/InferInput tests (acceptance criterion #2): verified by the compiler in
// vitest --typecheck mode (see vitest.config.ts → test.typecheck). The reference shapes are
// described MANUALLY and independently of Infer — otherwise the comparison would be a tautology.
import {expectTypeOf, test} from "vitest";
import {z} from "zod";
import {generateZodValidation, UrlLike, type Infer, type InferInput} from "@injitools/contract";
import {PlaceDto, GeoDto} from "./fixtures/infer-app.js";

// Expected OUTPUT (after Zod parsing): matches the declared field types,
// nested DTOs collapsed into a plain object, optional preserved.
type ExpectedOutput = {
    title: string;
    site: UrlLike;
    openedAt: Date;
    rating: number;
    verified: boolean;
    visits: bigint;
    note?: string;
    tags: string[];
    geo: {lat: number; lon: number};
    nearby: {lat: number; lon: number}[];
};

// Expected INPUT (before parsing): coercible primitives are relaxed to unknown,
// UrlLike accepts string, the rest is the same as output.
type ExpectedInput = {
    title: string;
    site: string;
    openedAt: unknown;
    rating: unknown;
    verified: unknown;
    visits: unknown;
    note?: string;
    tags: string[];
    // nested DTOs recursively follow the input shape: coercible fields → unknown
    geo: {lat: unknown; lon: unknown};
    nearby: {lat: unknown; lon: unknown}[];
};

test("Infer<typeof Dto> = the expected output structure", () => {
    expectTypeOf<Infer<typeof PlaceDto>>().toEqualTypeOf<ExpectedOutput>();
});

test("InferInput<typeof Dto> = the expected input structure", () => {
    expectTypeOf<InferInput<typeof PlaceDto>>().toEqualTypeOf<ExpectedInput>();
});

test("acceptance criterion: Infer ≡ z.infer<ReturnType<typeof generateZodValidation>>", () => {
    type ViaZod = z.infer<ReturnType<typeof generateZodValidation<typeof PlaceDto>>>;
    expectTypeOf<Infer<typeof PlaceDto>>().toEqualTypeOf<ViaZod>();
});

test("InferInput ≡ z.input<ReturnType<typeof generateZodValidation>>", () => {
    type ViaZodInput = z.input<ReturnType<typeof generateZodValidation<typeof PlaceDto>>>;
    expectTypeOf<InferInput<typeof PlaceDto>>().toEqualTypeOf<ViaZodInput>();
});

test("a nested DTO is inferred identically on its own and as a @DtoLink", () => {
    expectTypeOf<Infer<typeof GeoDto>>().toEqualTypeOf<{lat: number; lon: number}>();
    expectTypeOf<Infer<typeof PlaceDto>["geo"]>().toEqualTypeOf<Infer<typeof GeoDto>>();
    expectTypeOf<Infer<typeof PlaceDto>["nearby"]>().toEqualTypeOf<Infer<typeof GeoDto>[]>();
});

test("an optional field is marked as optional in both directions", () => {
    expectTypeOf<Infer<typeof PlaceDto>>().toHaveProperty("note");
    expectTypeOf<Infer<typeof PlaceDto>["note"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<InferInput<typeof PlaceDto>["note"]>().toEqualTypeOf<string | undefined>();
});
