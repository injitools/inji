# @injitools/db

TypeORM integration for the **Inji** framework: derive DTO validation from entity column metadata
in both directions (`@OrmLink` on a `@RequestDto`/`@ResponseDto`), generate Zod schemas, plus value
transformers and connection helpers.

Part of the [Inji](../../README.md) monorepo.

## Install

```bash
npm install @injitools/db typeorm
```

`typeorm` is a peer dependency. `big.js` is optional (needed only for `BigTransformer`).

## Usage

```ts
import {OrmLink, dbConnect, loadDbConfigFromEnv} from "@injitools/db";
import {ResponseDto} from "@injitools/core";

const db = await dbConnect(loadDbConfigFromEnv());

@ResponseDto(UserOrm, db)   // or @RequestDto(UserOrm, db) for an input body
class UserDto {
  @OrmLink() id: bigint;
  @OrmLink() email: string;
}
```

Importing `@injitools/db` registers the ORM validation resolver into `@injitools/core` (via
`setOrmZodResolver()`), so `@OrmLink` fields validate automatically. This keeps the core free of
TypeORM while `@OrmLink` derivation works (request and response) as soon as this package is present.

## Overriding a derived field

`@OrmLink` derives the whole schema from the column, but two escape hatches let you adjust it
**without unlinking the field**: the column still drives nullability/optionality, and a renamed or
removed column still fails loudly (which a hand-written `@DtoProperty` would not catch).

```ts
@RequestDto(UserOrm, db)
class RegisterDto {
  // extend — refine the derived schema. Here: the column's varchar(64) already gives max(64);
  // this adds a minimum on top. The callback receives the derived schema and returns a new one.
  @OrmLink({extend: (s) => s.min(3)})
  login: string;

  // validation — replace the derived type wholesale, when the wire form differs from the column's.
  @OrmLink({validation: z.string().uuid()})
  external_id: string;
}
```

Both run on the bare derived type — after the column type (and array-ness) is resolved, but before
the direction adds `.nullable()`/`.optional()`. That ordering is what lets `extend` call
refinements: it sees a plain `ZodString`, not a `ZodOptional` that has no `.min()`. If you pass
both, `validation` replaces first and `extend` then applies on top of the replacement.

## Dates on the wire

A **moment-in-time** column (`timestamptz`, `timestamp`, `datetime`, …) is an ISO-8601 string
**with an offset** on the wire, and a `Date` in the entity. The derivation reflects exactly that:

- `@ResponseDto` → `z.iso.datetime({offset: true})` — the ISO string as sent.
- `@RequestDto` → the same ISO string, parsed into a `Date`. A ready `Date` is also accepted (an
  inter-server caller may pass one). **Your domain services should take a `Date`** — the wire
  format is the API layer's business, and the DTO has already dealt with it.

This is deliberately stricter than `z.coerce.date()`, which used to back this and which silently
accepted a naive `"2026-01-01T00:00:00"` (no offset — the very ambiguity `timestamptz` exists to
prevent) and turned the number `0` into `1970-01-01`. It is also inexpressible in JSON Schema, so
zod-openapi degraded it to a bare `{type: "string"}` and the generated contract lost its
`format: date-time`.

> `date`, `time` and `year` columns are not moments in time and still use the old coercion — they
> carry no offset, so the ISO-datetime form would reject them.

## Conventions

### Don't repeat what the TS type already says

With `emitDecoratorMetadata: true`, TypeORM reads the property's TS type and normalizes it to a DB
type, and `generateOrmZodValidation()` handles the resulting constructor form (`String`/`Number`/
`Boolean`/`Date`) in the same switch branches as the string aliases. So for these, `type` is pure
noise — the derived DB type AND the emitted JSON Schema are byte-identical either way:

| Instead of | Write | Inferred DB type |
|---|---|---|
| `@Column({type: 'varchar', length: 64})` | `@Column({length: 64})` | `character varying(64)` |
| `@Column({type: 'boolean', default: true})` | `@Column({default: true})` | `boolean` |
| `@Column({type: 'int', default: 0})` | `@Column({default: 0})` | `integer` |

**Always keep `type` explicit when the TS type can't express it** — inference is either wrong or
impossible:

- **`text`** — a `string` infers to `varchar`, never `text`.
- **`timestamptz`** — a `Date` infers to `timestamp without time zone` (see below).
- **`bigint`** — a `bigint` property is a hard `DataTypeNotSupportedError` on Postgres without it.
- **`jsonb`**, **`uuid`**, **`enum`** — not derivable from `Object`/`string`.

Also keep everything the TS type erases or never carried: `length` (a bare `string` becomes an
unbounded `varchar`, and Zod then has no `.max()` to derive), `nullable` (the `| null` union is
erased at compile time), `unsigned`, `default`, `unique`.

> Inference fails loudly, not silently: with `emitDecoratorMetadata` off, TypeORM throws
> `ColumnTypeUndefinedError` while building metadata.

### Dates are always timezone-aware

**Every date/time column must declare an explicit timezone-aware type — `{type: 'timestamptz'}`
(Postgres) or the equivalent on your driver — including `@CreateDateColumn`/`@UpdateDateColumn`.**

Left without a `type`, TypeORM falls back to a driver default that is *not* timezone-aware: on
Postgres it's plain `timestamp` (`PostgresDriver.mappedDataTypes.createDate === "timestamp"`), which
stores a naive wall-clock value with no offset. `generateOrmZodValidation()` maps both `timestamp`
and `timestamptz` to the same Zod schema (`z.coerce.date()` on request, `z.iso.datetime({offset:
true})` on response), so a missing timezone doesn't surface as a validation error — it silently
produces ambiguous timestamps that drift once the app server or the database runs in a different
zone. Declare the type explicitly on every date column:

```ts
@CreateDateColumn({type: 'timestamptz'})
created_at: Date;

@Column({type: 'timestamptz', nullable: true})
last_seen: Date | null;
```

## License

MIT
