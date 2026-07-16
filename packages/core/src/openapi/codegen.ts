import {mkdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";

import type InjiRouter from "../router/Router.js";

import {buildOpenApiDocument} from "./document.js";

// Generator of TS interfaces for frontends from a router's OpenAPI document.
// Chain of truth: ORM entities + DTO → zod (@OrmLink/@DtoProperty) → zod-openapi → interfaces.
//
// The frontends never import @injitools/* — they consume the emitted schema.gen.ts through a thin
// fetch client. No DB connection is needed to run this: @OrmLink derives from column metadata
// (db.getMetadata), which TypeORM can build offline with db.buildMetadatas() — see an app's codegen.ts.
//
// This lives in @injitools/core (subpath "@injitools/core/codegen") rather than the main entry so
// that runtime servers do not pull in the node:fs-based generator.

export interface EmitOptions {
    title: string;
    port: number;
}

type Schema = Record<string, any>;

// Flags that at least one int64 (bigint) was encountered → add the Int64 type to the file header.
// Reset at the start of every emitSchema() (documents are generated sequentially).
let usesInt64 = false;

function refName(ref: string): string {
    return ref.replace("#/components/schemas/", "");
}

function isInt64(s: Schema): boolean {
    return s.format === "int64" || s.format === "bigint";
}

/** OpenAPI 3.1 SchemaObject → TS type string. */
function tsType(s: Schema | undefined): string {
    if (!s) return "unknown";
    if (s.$ref) return refName(s.$ref);

    const variants: Schema[] | undefined = s.anyOf ?? s.oneOf;
    if (variants) {
        return Array.from(new Set(variants.map(tsType))).join(" | ");
    }
    if (s.allOf) {
        return s.allOf.map(tsType).join(" & ");
    }
    if (Array.isArray(s.enum)) {
        return s.enum.map((v: unknown) => (typeof v === "string" ? JSON.stringify(v) : String(v))).join(" | ");
    }

    let type = s.type;
    let nullable = false;
    if (Array.isArray(type)) {
        nullable = type.includes("null");
        type = type.find((t: string) => t !== "null");
    }

    let base: string;
    // bigint/int64: a string on the wire (the precision does not fit in a number), but the type
    // is branded — the receiving side knows it is a bigint.
    if ((type === "integer" || type === "number" || type === "string") && isInt64(s)) {
        usesInt64 = true;
        base = "Int64";
    } else {
        switch (type) {
            case "string":
                base = "string";
                break;
            case "integer":
            case "number":
                base = "number";
                break;
            case "boolean":
                base = "boolean";
                break;
            case "array":
                base = `${tsType(s.items)}[]`;
                break;
            case "object":
                base = objectType(s);
                break;
            case "null":
                return "null";
            default:
                base = "unknown";
        }
    }
    return nullable ? `${base} | null` : base;
}

function objectType(s: Schema): string {
    if (!s.properties) return "Record<string, unknown>";
    const required = new Set<string>(s.required ?? []);
    const lines = Object.entries(s.properties).map(([key, value]) => {
        const opt = required.has(key) ? "" : "?";
        return `        ${key}${opt}: ${tsType(value as Schema)};`;
    });
    return `{\n${lines.join("\n")}\n    }`;
}

function emitDecl(name: string, s: Schema): string {
    if (s.properties || s.type === "object") {
        const required = new Set<string>(s.required ?? []);
        const props = s.properties ?? {};
        const lines = Object.entries(props).map(([key, value]) => {
            const opt = required.has(key) ? "" : "?";
            return `    ${key}${opt}: ${tsType(value as Schema)};`;
        });
        return `export interface ${name} {\n${lines.join("\n")}\n}`;
    }
    return `export type ${name} = ${tsType(s)};`;
}

const INT64_DECL =
    "/**\n" +
    " * bigint identifier. In JSON it arrives as a string (int64 does not fit in a number without\n" +
    " * losing precision), but the branded type tells the receiving side it is a bigint: it is not\n" +
    " * added as a number and is passed back as-is.\n" +
    " */\n" +
    "export type Int64 = string & {readonly __int64: unique symbol};";

/** Builds the OpenAPI document from the router and writes TS interfaces to target. */
export function emitSchema(router: InjiRouter, target: string, opts: EmitOptions): void {
    usesInt64 = false;
    const document = buildOpenApiDocument(router, {title: opts.title, port: opts.port});
    const schemas = (document.components?.schemas ?? {}) as Record<string, Schema>;
    const names = Object.keys(schemas).sort();
    const body = names.map((name) => emitDecl(name, schemas[name])).join("\n\n");

    const header =
        "// AUTO-GENERATED — do not edit by hand.\n" +
        "// Source: the API's OpenAPI document (ORM/DTO → zod → zod-openapi). Regenerate: npm run gen.\n\n";
    const content = header + (usesInt64 ? INT64_DECL + "\n\n" : "") + body + "\n";

    mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, content, "utf8");
    console.log(`gen: ${target} (${names.length} interfaces)`);
}
