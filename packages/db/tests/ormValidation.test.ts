// Direction-aware ORM derivation: a column is a single source of truth for BOTH a RequestDto
// and a ResponseDto, but the wire shapes differ. This exercises the exact chain codegen uses
// (ORM column metadata → zod), with a mock DataSource so no real database is needed.
import {describe, test, expect} from "vitest";
import {z} from "zod";
import {RequestDto, ResponseDto, generateZodValidation} from "@injitools/core";
// Importing @injitools/db registers the ORM→zod resolver via setOrmZodResolver (side effect).
import {OrmLink} from "@injitools/db";

// --- Fake TypeORM column metadata for a News-like entity ---------------------------------------
type Col = {
    type: any;
    isNullable?: boolean;
    isGenerated?: boolean;
    default?: any;
    length?: number;
};
const COLUMNS: Record<string, Col> = {
    id: {type: "bigint", isGenerated: true},          // generated PK
    title: {type: "varchar", length: 200},            // required text
    body: {type: "text"},                             // required text
    published: {type: "boolean", default: true},      // has a default
    author: {type: "varchar", length: 120, isNullable: true}, // nullable
    publish_at: {type: "timestamptz", isNullable: true},      // nullable date
    created_at: {type: "timestamp"},                  // required date
};

const fakeMeta = {
    targetName: "NewsFake",
    columns: Object.keys(COLUMNS).map((propertyName) => ({propertyName})),
    findColumnWithPropertyName: (p: string) =>
        COLUMNS[p] ? {propertyName: p, ...COLUMNS[p]} : undefined,
};
const db = {getMetadata: () => fakeMeta} as any;

class NewsFake {}

@ResponseDto(NewsFake, db)
class NewsResponse {
    @OrmLink() id!: bigint;
    @OrmLink() title!: string;
    @OrmLink() body!: string;
    @OrmLink() published!: boolean;
    @OrmLink() author?: string;
    @OrmLink() publish_at?: string;
    @OrmLink() created_at!: string;
}

@RequestDto(NewsFake, db)
class NewsRequest {
    @OrmLink() id?: bigint;
    @OrmLink() title!: string;
    @OrmLink() published?: boolean;
    @OrmLink() author?: string;
}

@RequestDto(NewsFake, db)
class NewsPatch {
    @OrmLink({optional: true}) title?: string; // force-optional override on a required column
}

const ISO = "2026-01-01T00:00:00Z";

describe("response direction", () => {
    const schema = generateZodValidation(NewsResponse);

    test("nullable columns are optional; everything else is required (incl. generated/defaulted)", () => {
        // author + publish_at (nullable) may be omitted; id (generated) and published (default) are required.
        expect(schema.safeParse({
            id: 5n, title: "t", body: "b", published: true, created_at: ISO,
        }).success).toBe(true);
    });

    test("a generated PK is REQUIRED in a response (always present on the wire)", () => {
        expect(schema.safeParse({title: "t", body: "b", published: true, created_at: ISO}).success).toBe(false);
    });

    test("date columns are ISO strings, not Date objects", () => {
        expect(schema.safeParse({
            id: 5n, title: "t", body: "b", published: true, created_at: new Date(),
        }).success).toBe(false);
    });

    test("a nullable column is optional (undefined) but not null in a response", () => {
        expect(schema.safeParse({
            id: 5n, title: "t", body: "b", published: true, created_at: ISO, author: null,
        }).success).toBe(false);
    });
});

describe("request direction", () => {
    const schema = generateZodValidation(NewsRequest);

    test("generated/default/nullable columns are optional; plain columns required", () => {
        expect(schema.safeParse({title: "t"}).success).toBe(true); // id/published/author omitted
        expect(schema.safeParse({}).success).toBe(false);           // title missing
    });

    test("a nullable column additionally accepts an explicit null", () => {
        expect(schema.safeParse({title: "t", author: null}).success).toBe(true);
    });

    test("@OrmLink({optional: true}) forces a required column optional", () => {
        expect(generateZodValidation(NewsPatch).safeParse({}).success).toBe(true);
    });
});

// An entity may omit `type` and let TypeORM infer it from the TS type (emitDecoratorMetadata) —
// the skeleton entities do exactly that (`@Column({length: 200}) title: string`). TypeORM then puts
// the CONSTRUCTOR (String/Number/Boolean/Date) into columnMeta.type instead of a string alias, so
// the resolver must derive an identical schema from either form. Without this the two forms could
// silently drift and inferred columns would emit a different API contract.
describe("column type inferred from the TS type (constructor form)", () => {
    const ALIAS: Record<string, Col> = {
        title: {type: "varchar", length: 200},
        published: {type: "boolean", default: true},
        count: {type: "int", default: 0},
        author: {type: "varchar", length: 120, isNullable: true},
        created_at: {type: "timestamptz"},
    };
    const CONSTRUCTOR: Record<string, Col> = {
        title: {type: String, length: 200},
        published: {type: Boolean, default: true},
        count: {type: Number, default: 0},
        author: {type: String, length: 120, isNullable: true},
        created_at: {type: Date},
    };

    const dbOf = (cols: Record<string, Col>) => ({
        getMetadata: () => ({
            targetName: "Fake",
            columns: Object.keys(cols).map((propertyName) => ({propertyName})),
            findColumnWithPropertyName: (p: string) => (cols[p] ? {propertyName: p, ...cols[p]} : undefined),
        }),
    }) as any;

    class AliasEntity {}
    class ConstructorEntity {}

    @ResponseDto(AliasEntity, dbOf(ALIAS))
    class AliasResponse {
        @OrmLink() title!: string;
        @OrmLink() published!: boolean;
        @OrmLink() count!: number;
        @OrmLink() author?: string;
        @OrmLink() created_at!: string;
    }

    @ResponseDto(ConstructorEntity, dbOf(CONSTRUCTOR))
    class ConstructorResponse {
        @OrmLink() title!: string;
        @OrmLink() published!: boolean;
        @OrmLink() count!: number;
        @OrmLink() author?: string;
        @OrmLink() created_at!: string;
    }

    @RequestDto(AliasEntity, dbOf(ALIAS))
    class AliasRequest {
        @OrmLink() title!: string;
        @OrmLink() published?: boolean;
        @OrmLink() count?: number;
        @OrmLink() author?: string;
    }

    @RequestDto(ConstructorEntity, dbOf(CONSTRUCTOR))
    class ConstructorRequest {
        @OrmLink() title!: string;
        @OrmLink() published?: boolean;
        @OrmLink() count?: number;
        @OrmLink() author?: string;
    }

    const jsonSchema = (dto: any, io: "input" | "output") =>
        z.toJSONSchema(generateZodValidation(dto) as any, {io});

    test("a response schema is identical whichever form the column type takes", () => {
        expect(jsonSchema(ConstructorResponse, "output")).toEqual(jsonSchema(AliasResponse, "output"));
    });

    test("a request schema is identical whichever form the column type takes", () => {
        expect(jsonSchema(ConstructorRequest, "input")).toEqual(jsonSchema(AliasRequest, "input"));
    });

    test("an inferred varchar still derives its length limit", () => {
        const schema = generateZodValidation(ConstructorRequest);
        expect(schema.safeParse({title: "x".repeat(200)}).success).toBe(true);
        expect(schema.safeParse({title: "x".repeat(201)}).success).toBe(false);
    });
});

// A moment-in-time column on the wire is an ISO-8601 string WITH an offset. A request parses it
// into a Date (the domain never sees the wire format); a response carries the string as sent.
describe("timestamp columns in a request", () => {
    @RequestDto(NewsFake, db)
    class DateRequest {
        @OrmLink() publish_at?: Date;
    }
    const schema = generateZodValidation(DateRequest);

    test("an ISO string with an offset parses into a Date", () => {
        const r = schema.safeParse({publish_at: "2026-01-01T00:00:00Z"});
        expect(r.success).toBe(true);
        expect((r as any).data.publish_at).toBeInstanceOf(Date);
        expect((r as any).data.publish_at.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    test("a ready Date is still accepted (an inter-server caller may pass one)", () => {
        const now = new Date();
        const r = schema.safeParse({publish_at: now});
        expect(r.success).toBe(true);
        expect((r as any).data.publish_at.toISOString()).toBe(now.toISOString());
    });

    test("a timestamp with NO offset is rejected — that ambiguity is what timestamptz prevents", () => {
        expect(schema.safeParse({publish_at: "2026-01-01T00:00:00"}).success).toBe(false);
    });

    test("a bare number is rejected (z.coerce.date() silently made 0 → 1970)", () => {
        expect(schema.safeParse({publish_at: 0}).success).toBe(false);
    });

    test("an Invalid Date is rejected rather than throwing inside the preprocess", () => {
        expect(schema.safeParse({publish_at: new Date("nonsense")}).success).toBe(false);
    });

    test("the emitted contract keeps format: date-time (a union would widen it to anyOf)", () => {
        const json: any = z.toJSONSchema(schema as any, {io: "input"});
        // nullable column → anyOf[<the date form>, null]; find the non-null branch.
        const prop = json.properties.publish_at;
        const branch = prop.anyOf ? prop.anyOf.find((b: any) => b.type !== "null") : prop;
        expect(branch.type).toBe("string");
        expect(branch.format).toBe("date-time");
    });
});

// @OrmLink overrides: the field stays LINKED to the column (nullability/optionality still derive
// from it, a renamed column still throws), only the derived type is replaced or refined.
describe("@OrmLink overrides", () => {
    @RequestDto(NewsFake, db)
    class ExtendRequest {
        // Column gives max(200); the extension adds a minimum on top of it.
        @OrmLink({extend: (s) => s.min(3)}) title!: string;
    }

    @RequestDto(NewsFake, db)
    class ValidationRequest {
        // Replace the derived type wholesale — the wire form differs from the column's own type.
        @OrmLink({validation: z.enum(["a", "b"])}) title!: string;
    }

    @RequestDto(NewsFake, db)
    class BothRequest {
        @OrmLink({validation: z.string(), extend: (s) => s.min(3)}) title!: string;
    }

    test("extend refines the derived schema without discarding it", () => {
        const schema = generateZodValidation(ExtendRequest);
        expect(schema.safeParse({title: "ab"}).success).toBe(false);        // added min(3)
        expect(schema.safeParse({title: "abc"}).success).toBe(true);
        expect(schema.safeParse({title: "x".repeat(201)}).success).toBe(false); // derived max(200) survives
    });

    test("validation replaces the derived schema", () => {
        const schema = generateZodValidation(ValidationRequest);
        expect(schema.safeParse({title: "a"}).success).toBe(true);
        expect(schema.safeParse({title: "zzz"}).success).toBe(false);
    });

    test("validation and extend compose — extend applies on top of the replacement", () => {
        const schema = generateZodValidation(BothRequest);
        expect(schema.safeParse({title: "ab"}).success).toBe(false);
        expect(schema.safeParse({title: "abcdefg".repeat(100)}).success).toBe(true); // no max: replaced
    });

    test("an overridden field still derives optionality from the column", () => {
        @RequestDto(NewsFake, db)
        class NullableOverride {
            // publish_at is nullable → optional and null-accepting, even with the type replaced.
            @OrmLink({validation: z.string()}) publish_at?: string;
        }
        const schema = generateZodValidation(NullableOverride);
        expect(schema.safeParse({}).success).toBe(true);
        expect(schema.safeParse({publish_at: null}).success).toBe(true);
        expect(schema.safeParse({publish_at: 5}).success).toBe(false);
    });

    test("an override does NOT silence a wrong column name", () => {
        @RequestDto(NewsFake, db)
        class BadColumn {
            @OrmLink({validation: z.string()}) nope!: string;
        }
        expect(() => generateZodValidation(BadColumn)).toThrow(/does not match any column/);
    });
});
