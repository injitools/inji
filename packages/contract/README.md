# @injitools/contract

The **DTO/validation layer** of the Inji framework: the `RequestDto`/`ResponseDto` decorators, a
metadata store, and Zod validation. It depends only on `zod` + `reflect-metadata` — **no**
`express`, **no** `got`, **no** `typeorm`, **no** node-core. This is deliberate layering hygiene:
contract is the dependency-light base that `core`/`db`/`auth` build on, so keeping it free of
server dependencies avoids dependency cycles.

You normally do not depend on this package directly: `@injitools/core` depends on
`@injitools/contract` and re-exports the entire API, so backends import from `@injitools/core`.

## What it exports

- the `RequestDto`, `ResponseDto` decorators (the two DTO kinds) — plus `Dto` (deprecated alias of
  `RequestDto`) and the `DtoProperty`, `DtoLink`, `DtoLinkArray` field decorators;
- `DtoStorage`, `DtoType`, `DtoPropertyType`, `DtoDirection` and the metadata types (`TDto*`);
- `generateZodValidation`, `generateSchema`, `generatePrimitiveZodValidation`,
  `detectContentType`, `isPrimitiveType`, `boolFromQueryOrJson`;
- `dataToDto`;
- the type-level helpers `Infer<typeof Dto>` (output, ≡ `z.infer`) and `InferInput<typeof Dto>`
  (input before parsing, ≡ `z.input`);
- the `UrlLike` / `UrlLikeSchema` primitives, `PRIMITIVE_TYPES`, the `PrimitiveType` type;
- `setOrmZodResolver` / `OrmZodResolver` — the ORM-validation seam (the resolver is registered by
  `@injitools/db`, so typeorm never enters this graph). The resolver is direction-aware: the same
  column derives a request field (input semantics) or a response field (output semantics);
- the canonical `ErrorResponseDto`.

## Decorator metadata (important)

A DTO field's type is derived **from the code** via `design:type`, so the consumer must build with
a toolchain that **emits decorator metadata**. Otherwise `@DtoProperty()` without an explicit type
yields `Reflect.getMetadata('design:type', …) === undefined` and validation fails at runtime with
`Unsupported primitive: undefined`.

- **reflect-metadata** — nothing to do: the package loads it itself on the first line of the entry,
  before any DTO is declared (importing it again is harmless).
- **tsconfig** — `experimentalDecorators: true`, `emitDecoratorMetadata: true`, and (with
  target ≥ ES2022) `useDefineForClassFields: false` so class fields don't overwrite decorator metadata.
- **transform** — build through `tsc` or SWC (`legacyDecorator + decoratorMetadata`); esbuild/tsx
  do **not** emit metadata.

## Checks (tests)

- `tests/no-orm-leak.test.ts` — source scan: fails if any `src/**` import pulls in a server
  dependency (typeorm/`@injitools/db`/`@injitools/auth`/express/got).
- `tests/graph.test.ts` — walks the built package graph: only `zod` + `reflect-metadata` allowed.
- `tests/contract.unit.test.ts` — a smoke test of the DTO layer: type inference from `design:type`,
  `dataToDto`, `ErrorResponseDto`.
- `tests/infer.test-d.ts` — **type-level** `Infer`/`InferInput` tests (`vitest --typecheck`).
- `tests/infer.runtime.test.ts` — a runtime check: the schema parses the input shape into the output
  shape exactly as the types promise (coercion, `UrlLike`, optional, `strictObject`).

```bash
npm test -w @injitools/contract
```
