// @injitools/contract — the DTO/validation layer of the Inji framework.
//
// Contains the DTO decorators, the metadata storage and Zod validation. Depends solely on
// zod + reflect-metadata — NO express, NO got, NO typeorm, NO node-core. This is layering
// hygiene: contract is the dependency-light base that core/db/auth build on, so keeping it free
// of server deps avoids dependency cycles (enforced by tests/graph + tests/no-orm-leak).
//
// Self-sufficiency: the package loads reflect-metadata itself as its first line, so the
// polyfill is guaranteed to come up before any decorated DTO class is declared.
// reflect-metadata is protected against re-initialization, so if the application has already
// pulled in the polyfill, there is no conflict.
import "reflect-metadata";

// ── DTO decorators ────────────────────────────────────────────────────────────────
// A DTO's direction is first-class: RequestDto (input) and ResponseDto (output) are separate
// kinds — both may bind a TypeORM entity and derive fields via @OrmLink, each with its own
// optionality/date semantics. A single class must not be reused for both directions.
export {default as RequestDto} from "./decorators/RequestDto.js";
export {default as ResponseDto} from "./decorators/ResponseDto.js";
/** @deprecated alias of RequestDto — see decorators/Dto.ts */
export {default as Dto} from "./decorators/Dto.js";
export {default as DtoProperty} from "./decorators/DtoProperty.js";
export {default as DtoLink} from "./decorators/DtoLink.js";
export {default as DtoLinkArray} from "./decorators/DtoLinkArray.js";

// ── Canonical error DTO + validation parsing for the frontend ───────────
// ErrorResponseDto — the single envelope {error, message, payload, inherit} that the server
// returns via errorMiddleware and the web imports from here as well. For validation errors the
// payload carries {formErrors, fieldErrors} (flattenZodIssues) — a structure for highlighting form fields.
export {default as ErrorResponseDto} from "./dto/ErrorResponseDto.js";
export {flattenZodIssues, isValidationErrorPayload} from "./validators/zodErrors.js";
export type {ValidationErrorPayload, ZodFieldErrors} from "./validators/zodErrors.js";

// ── Converting data into a DTO ─────────────────────────────────────────────────────
export {dataToDto} from "./dto.js";

// ── Type-level inference of the static type from a DTO class ────────────────────────
// Infer<typeof Dto> ≡ z.infer of the schema; InferInput<typeof Dto> ≡ z.input (for validating
// input before sending). Types only — erased at build time.
export type {Infer, InferInput, DtoConstructor} from "./infer.js";

// ── Validation and Zod schema generation ───────────────────────────────────────────
// setOrmZodResolver — the seam for ORM validation: the resolver itself (typeorm-dependent) lives
// in @injitools/db and is registered externally, so contract stays free of server deps.
export {
    generateZodValidation,
    generateSchema,
    generatePrimitiveZodValidation,
    detectContentType,
    isPrimitiveType,
    setOrmZodResolver,
    UrlLike,
    UrlLikeSchema,
    PRIMITIVE_TYPES,
    boolFromQueryOrJson,
} from "./validators/validation.js";
export type {OrmZodResolver, PrimitiveType} from "./validators/validation.js";

// ── Reusable zod primitives ──────────────────────────────────────────────
// Ready-made validators for @DtoProperty({validation: ...}) — they remove duplication in DTOs.
export {
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
} from "./validators/primitives.js";

// ── DTO storage and metadata types ─────────────────────────────────────────────────
export {default as DtoStorage, DtoType, DtoPropertyType} from "./storages/DtoStorage.js";
export type {
    DtoDirection,
    TDtoClass,
    TDto,
    TDtoStruct,
    TDtoOrm,
    TDtoRecord,
    TDtoProperty,
    TDtoLinkProperty,
    TOrmLinkProperty,
    TDtoPrimitiveProperty,
} from "./storages/DtoStorage.js";
