// @injitools/core — the framework core's public API.
// reflect-metadata is required by decorators (Reflect.getMetadata). We import it here
// so the polyfill is guaranteed to load before any decorated class is declared.
import "reflect-metadata";

// ── Router (runtime Express + OpenAPI assembler) ─────────────────────────────────
// Assembler class: new InjiRouter([Controllers]). ApiServer alias for readability at the entry point.
export {default as InjiRouter} from "./router/Router.js";
export {default as ApiServer} from "./router/Router.js";
// Type-safe fetch client for inter-server (node↔node) calls between backends built from controller classes.
export {createApiClient, createFetchClient, ApiClientError} from "./router/RouterClient.js";
export type {RouterClient, ApiClientOptions, FetchLike} from "./router/RouterClient.js";
export {dataToDto} from "@injitools/contract";

// ── Method/class decorators ─────────────────────────────────────────────────
// @Router('path') — applied to a controller class.
export {default as Router} from "./router/decorators/Router.js";
export {default as Controller} from "./router/decorators/Router.js"; // alias for @Router
export {Get, Post, Put, Patch, Delete} from "./router/decorators/Method.js";
export {Response} from "./router/decorators/Response.js";
export {default as Middleware} from "./router/decorators/Middleware.js";

// ── Parameter decorators ──────────────────────────────────────────────────────
export {Body, Query, Params, Headers, Req, Res, Next, Meta} from "./router/decorators/Param.js";
export {default as Path} from "./router/decorators/Path.js";

// ── DTO ───────────────────────────────────────────────────────────────────────
// The DTO/validation layer lives in a separate package, @injitools/contract (no server deps).
// The core re-exports it, so the public API of @injitools/core is unchanged.
// RequestDto/ResponseDto are the two DTO kinds — both may bind an ORM entity (@OrmLink).
export {
    RequestDto,
    ResponseDto,
    Dto,
    DtoProperty,
    DtoLink,
    DtoLinkArray,
    ErrorResponseDto,
    // Validation parsing for the frontend + zod primitives.
    flattenZodIssues,
    isValidationErrorPayload,
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
} from "@injitools/contract";
export type {ValidationErrorPayload, ZodFieldErrors} from "@injitools/contract";

// ── Middleware infrastructure ──────────────────────────────────────────────────
export {default as RouterMiddleware, createMiddleware} from "./router/middlewares/RouterMiddleware.js";
export type {OpenApiMiddlewareMeta} from "./router/middlewares/RouterMiddleware.js";
export {errorMiddleware} from "./router/middlewares/ErrorMiddleware.js";

// ── Errors ─────────────────────────────────────────────────────────────────────
export {RequestError} from "./router/errors/RequestError.js";
export {ValidationError} from "./router/errors/ValidationError.js";
export {ZodValidationError} from "./router/errors/ZodValidationError.js";

// ── Validation (including the ORM hook for @injitools/db) ───────────────────────────────────
// Re-export from @injitools/contract: the server-side @injitools/core API is preserved unchanged.
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
} from "@injitools/contract";
export type {OrmZodResolver, OrmZodOverrides, PrimitiveType} from "@injitools/contract";
// Type-level inference of the static type from a DTO class (the same API as in the #contract entry).
export type {Infer, InferInput, DtoConstructor} from "@injitools/contract";

// ── Storages and metadata types ────────────────────────────────────────────────
export {default as RoutesStorage} from "./router/storages/RoutesStorage.js";
export type {
    HttpMethod,
    ParamSource,
    MiddlewareLike,
    TRouter,
    TRouterRecord,
    TRouterMethod,
    TRouterMethodRecord,
    TRouterMethodParam,
    TRouterResponse,
} from "./router/storages/RoutesStorage.js";

export {DtoStorage, DtoType, DtoPropertyType} from "@injitools/contract";
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
} from "@injitools/contract";

// ── OpenAPI ──────────────────────────────────────────────────────────────
// buildOpenApiDocument (router → OpenAPI 3.1 doc) is used by servers for Swagger/openapi.json.
// The TS-interface generator emitSchema lives in the "@injitools/core/codegen" subpath (node:fs)
// so runtime servers do not pull in the generator.
export {buildOpenApiDocument} from "./openapi/document.js";
export type {OpenApiOptions} from "./openapi/document.js";

// ── Tools ────────────────────────────────────────────────────────────────
export {trimSlashes} from "./tools/String.js";
