// Direction-aware ORM derivation: a column is a single source of truth for BOTH a RequestDto
// and a ResponseDto, but the wire shapes differ. This exercises the exact chain codegen uses
// (ORM column metadata → zod), with a mock DataSource so no real database is needed.
import {describe, test, expect} from "vitest";
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
