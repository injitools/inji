// Type-level inference of the static structure directly from a DTO class — without codegen and
// without manual type duplication. The source of truth is the DTO CLASS itself: the field types are
// already declared in its body (`name: string`, `address: AddressDto`, `nickname?: string`),
// so `InstanceType<typeof Dto>` carries the whole structure, while the decorators (runtime metadata
// in DtoStorage) are invisible at the type level and not required.
//
// Why two helpers and not one:
//   • Infer       — the output form (after Zod parsing): what the server returns / the consumer
//                   receives. Matches the declared field types (`number`, `Date`,
//                   `UrlLike`, a nested DTO → plain object).
//   • InferInput  — the input form (before parsing): what the Zod schema ACCEPTS as input. Needed
//                   for client-side validation before sending. Coercible primitives
//                   (`z.coerce.*`) are relaxed to `unknown`, `UrlLike` (string-transform)
//                   to `string`.
//
// The contract is kept in sync with the schema generator: see generatePrimitiveZodValidation in
// ./validators/validation.ts — if the coercion there changes, the mapping below must be updated.
// Equivalence is guaranteed by construction: generateZodValidation is typed as
// ZodType<Infer<T>, InferInput<T>>, so z.infer/z.input of the schema match Infer/InferInput.
import type {UrlLike} from "./validators/validation.js";

// The constructor of a DTO class. We accept both abstract and regular classes — InstanceType is
// taken from either. Target DX: Infer<typeof CheckinDto>.
export type DtoConstructor = abstract new (...args: any[]) => any;

// Scalar "leaves" that we do NOT unfold as a nested DTO. UrlLike/Date are classes,
// but on the wire they are primitive values, so they are mapped by dedicated branches.
type DtoLeaf = string | number | boolean | bigint | Date | UrlLike;

// Mapping of the OUTPUT structure from the declared value type. For most fields the output
// matches the annotation; nested DTOs are recursively collapsed into a plain object — exactly
// as z.infer of the nested schema does.
type OutputOf<V> =
    V extends UrlLike ? UrlLike :
    V extends Date ? Date :
    V extends Array<infer E> ? Array<OutputOf<E>> :
    V extends DtoLeaf ? V :
    V extends object ? {[K in keyof V]: OutputOf<V[K]>} :
    V;

// Mapping of the INPUT structure: coercible primitives are relaxed to what the schema actually
// accepts BEFORE parsing (z.coerce.* → unknown, UrlLikeSchema = string→UrlLike → string).
type InputOf<V> =
    V extends UrlLike ? string :
    V extends Date ? unknown :
    V extends number ? unknown :
    V extends bigint ? unknown :
    V extends boolean ? unknown :
    V extends string ? string :
    V extends Array<infer E> ? Array<InputOf<E>> :
    V extends object ? {[K in keyof V]: InputOf<V[K]>} :
    V;

/**
 * The static output type of a DTO class (after Zod parsing).
 * Equivalent to `z.infer<ReturnType<typeof generateZodValidation>>` for the same DTO.
 *
 * @example
 *   type Checkin = Infer<typeof CheckinDto>; // { ... } without describing it by hand
 */
export type Infer<T extends DtoConstructor> = OutputOf<InstanceType<T>>;

/**
 * The static input type of a DTO class (what the schema accepts BEFORE parsing).
 * Equivalent to `z.input<ReturnType<typeof generateZodValidation>>`. Useful for
 * validating data on the client before sending.
 */
export type InferInput<T extends DtoConstructor> = InputOf<InstanceType<T>>;
