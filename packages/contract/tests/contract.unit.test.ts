// Unit smoke of the ported contract layer: decorators register metadata,
// Zod schema generation infers types from the code (design:type), dataToDto builds instances,
// the canonical ErrorResponseDto validates.
//
// The fixture files are transformed by Vite/Oxc with emitDecoratorMetadata (see vitest.config.ts),
// so @DtoProperty() without an explicit type works here — this is exactly the check of isomorphic
// type inference.
import {describe, test, expect} from "vitest";
import {
    UserDto,
    AddressDto,
    buildUserSchema,
    dataToDto,
    generateZodValidation,
    ErrorResponseDto,
} from "./fixtures/contract-app.js";

describe("generateZodValidation (type inference from design:type)", () => {
    test("a valid object passes, age is coerced to a number", () => {
        const schema = buildUserSchema();
        const parsed: any = schema.parse({
            name: "Ann",
            age: "42", // string → coerce.number → 42
            address: {city: "Riga", zip: "1001"},
            prevAddresses: [{city: "Old", zip: "0000"}],
        });
        expect(parsed.age).toBe(42);
        expect(typeof parsed.age).toBe("number");
        expect(parsed.address.city).toBe("Riga");
    });

    test("an optional field can be omitted", () => {
        const schema = buildUserSchema();
        const r = schema.safeParse({
            name: "Bob",
            age: 7,
            address: {city: "X", zip: "1"},
            prevAddresses: [],
        });
        expect(r.success).toBe(true);
    });

    test("a wrong type is rejected (name as a number — z.string without coerce)", () => {
        const schema = buildUserSchema();
        const r = schema.safeParse({
            name: 123,
            age: 1,
            address: {city: "X", zip: "1"},
            prevAddresses: [],
        });
        expect(r.success).toBe(false);
    });
});

describe("dataToDto", () => {
    test("builds DTO class instances, including nested links", () => {
        const entity: any = dataToDto(UserDto, {
            name: "Ann",
            age: 30,
            address: {city: "Riga", zip: "1001"},
            prevAddresses: [{city: "Old", zip: "0000"}],
        });
        expect(entity).toBeInstanceOf(UserDto);
        expect(entity.address).toBeInstanceOf(AddressDto);
        expect(entity.prevAddresses[0]).toBeInstanceOf(AddressDto);
        expect(entity.name).toBe("Ann");
    });
});

describe("ErrorResponseDto", () => {
    test("the canonical error DTO validates", () => {
        const schema = generateZodValidation(ErrorResponseDto);
        const r = schema.safeParse({
            error: "BadRequest",
            message: "Something went wrong",
            payload: {field: "name"},
            inherit: ["ValidationError"],
        });
        expect(r.success).toBe(true);
    });
});
