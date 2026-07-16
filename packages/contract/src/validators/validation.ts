import {z, ZodType} from "zod";
import DtoStorage, {
    DtoDirection,
    DtoPropertyType,
    TDtoClass,
    TDtoOrm,
} from "../storages/DtoStorage.js";
import type {Infer, InferInput, DtoConstructor} from "../infer.js";

const zodRegistry: { [id: string]: ZodType } = {}

/**
 * A hook for ORM validation. The core (@injitools/core) does not depend on typeorm, so
 * generating a Zod schema from ORM column metadata is delegated outward.
 * The @injitools/db package registers the implementation via setOrmZodResolver() when imported.
 */
export type OrmZodOverrides = {
    /** Replaces the schema derived from the column. */
    validation?: ZodType
    /** Receives the derived schema and returns a new one (e.g. adds .min() to a derived .max()). */
    extend?: (schema: any) => ZodType
}
export type OrmZodResolver = (
    db: unknown,
    ormClass: Function,
    ormProperty: string,
    direction: DtoDirection,
    overrides?: OrmZodOverrides,
) => ZodType
let ormZodResolver: OrmZodResolver | null = null

export function setOrmZodResolver(resolver: OrmZodResolver) {
    ormZodResolver = resolver
}

const boolFromQueryOrJson = () => z.preprocess((input) => {
    if (typeof input === "boolean") return input;

    if (typeof input === "number") {
        if (input === 1) return true;
        if (input === 0) return false;

        return input
    }

    if (typeof input === "string") {
        const v = input.trim().toLowerCase();

        if (["false", "0", "no", "off", "n", "disabled", ""].includes(v)) return false
        if (["true", "1", "yes", "on", "y", "enabled"].includes(v)) return true

        return input;
    }

    return input;
}, z.boolean());

export class UrlLike extends URL {
    public raw: string
    public clean: string

    constructor(url: string) {
        let trimmed = url.trim();

        // triple encoded
        if (trimmed.includes('%252F')) {
            trimmed = decodeURIComponent(trimmed)
        }
        // doubly encoded
        if (trimmed.includes('%2F')) {
            trimmed = decodeURIComponent(trimmed)
        }

        // If there is no protocol — prepend https://
        const withProtocol = /^https?:\/\//i.test(trimmed)
            ? trimmed
            : `https://${trimmed}`;

        super(withProtocol);
        this.raw = url;
        this.clean = trimmed.replace(/^(https?:\/\/)?(www\.)?/i, '')
    }
}

export const UrlLikeSchema = z.string().transform((value, ctx) => {
    try {
        return new UrlLike(value);
    } catch {
        ctx.addIssue({
            code: 'custom',
            message: 'Invalid URL',
        });
        return z.NEVER;
    }
});

// Typed entry: for a DTO class the return carries the static type ZodType<Infer<T>, InferInput<T>>,
// so z.infer/z.input of the schema match Infer/InferInput by construction (#contract-entry).
export function generateZodValidation<T extends DtoConstructor>(dtoClass: T): ZodType<Infer<T>, InferInput<T>>;
// Loose entry: internal recursion over TDtoClass (including Function) and calls from generateSchema.
export function generateZodValidation(dtoClass: TDtoClass): ZodType;
export function generateZodValidation(dtoClass: TDtoClass): ZodType {
    const dto = DtoStorage.get(dtoClass);

    if (!dto) {
        return z.object()
    }

    if (zodRegistry[dtoClass.name]) {
        return zodRegistry[dtoClass.name]
    }
    const object: any = {}
    for (const [key, property] of Object.entries(dto.properties)) {
        switch (property.type) {
            case DtoPropertyType.DTO_LINK:
                object[key] = generateZodValidation(property.class)
                if (property.array) {
                    object[key] = z.array(object[key])
                }
                break
            case DtoPropertyType.ORM_LINK:
                if (!ormZodResolver) {
                    throw new Error(
                        `ORM validation is not registered. Field "${key}" uses @OrmLink, ` +
                        `but no resolver is set. Install the @injitools/db package and import it before startup.`
                    )
                }
                object[key] = ormZodResolver(
                    (dto as TDtoOrm).db,
                    (dto as TDtoOrm).ormClass,
                    property.ormProperty,
                    dto.direction,
                    {validation: property.validation, extend: property.extend},
                )
                // Per-field override: force optional for partial DTOs regardless of direction.
                if (property.optional) {
                    object[key] = object[key].optional()
                }
                break
            case DtoPropertyType.PRIMITIVE:
                object[key] = generatePrimitiveZodValidation(property.primitive, property.options)
        }
    }
    return zodRegistry[dtoClass.name] = z.strictObject(object).meta({id: dtoClass.name})
}

export const PRIMITIVE_TYPES = [String, Number, Boolean, BigInt, Date, UrlLike] as const
export type PrimitiveType = typeof PRIMITIVE_TYPES[number]

export function isPrimitiveType(type: any): type is PrimitiveType {
    return PRIMITIVE_TYPES.includes(type)
}

function isLiteralObject(type: any): boolean {
    return typeof type === 'object' && type !== null && !Array.isArray(type) && type.constructor === Object
}

function generateLiteralObjectSchema(obj: Record<string, any>): ZodType {
    const shape: Record<string, ZodType> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            shape[key] = z.literal(value)
        } else {
            shape[key] = z.unknown()
        }
    }
    return z.object(shape)
}

export function detectContentType(type: any): string {
    if (isPrimitiveType(type)) {
        return 'text/html'
    }
    return 'application/json'
}

export function generateSchema(type: any): ZodType {
    // Primitive types
    if (isPrimitiveType(type)) {
        return generatePrimitiveZodValidation(type)
    }

    // Literal objects
    if (isLiteralObject(type)) {
        return generateLiteralObjectSchema(type)
    }

    // DTO classes
    if (typeof type === 'function' && DtoStorage.has(type)) {
        return generateZodValidation(type)
    }

    return z.unknown()
}

export function generatePrimitiveZodValidation(primitive: PrimitiveType | any, options?: {
    optional?: boolean,
    validation?: ZodType,
}) {
    // If an explicit schema is passed in options.validation — use it as is
    if (options?.validation) {
        return options.optional ? options.validation.optional() : options.validation
    }

    let schema: ZodType
    switch (primitive) {
        case String:
            schema = z.string()
            break
        case Number:
            schema = z.coerce.number()
            break
        case Boolean:
            schema = boolFromQueryOrJson()
            break
        case BigInt:
            schema = z.coerce.bigint()
            break
        case Date:
            schema = z.coerce.date()
            break
        case UrlLike:
            schema = UrlLikeSchema
            break
        default:
            throw new Error(`Unsupported primitive: ${primitive}`)
    }
    if (options?.optional) {
        schema = schema.optional()
    }
    return schema
}

export {boolFromQueryOrJson}
