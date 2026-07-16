# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

All `@injitools/*` packages are versioned in lockstep and released together from a single `v*.*.*`
tag, so one entry below covers every package; the affected package is named on each line.

## [Unreleased]

## [0.2.0] - 2026-07-17

### Added

- **`@injitools/db` — `@OrmLink` can now override the derived schema, two ways.** Both keep the
  field linked to the column (it still drives nullability/optionality, and a renamed column still
  throws), unlike a hand-written `@DtoProperty`:
  - `@OrmLink({extend: (s) => s.min(3)})` — refine the derived schema (the column's `varchar(64)`
    still contributes `.max(64)`).
  - `@OrmLink({validation: z.string().uuid()})` — replace the derived type wholesale, when the wire
    form differs from the column's own type.

  Both act on the bare type, before the direction adds `.nullable()`/`.optional()`, so refinements
  are available. Passing both replaces first, then extends.

### Changed

- **`@injitools/db` — a date column in a `@RequestDto` now takes an ISO-8601 string and yields a
  `Date`, instead of `z.coerce.date()`.** The old coercion accepted a naive
  `"2026-01-01T00:00:00"` with no offset — the exact ambiguity a `timestamptz` column exists to
  prevent — and turned the number `0` into `1970-01-01`. It is also inexpressible in JSON Schema,
  so zod-openapi degraded it to a bare `{type: "string"}` and the generated contract silently lost
  its `format: date-time`. Deriving from the ORM gave a *weaker* contract than writing the field by
  hand; it now gives a stricter one. A ready `Date` is still accepted, so inter-server callers are
  unaffected. **Migration:** date fields still parse to a `Date` (the output type is unchanged), but
  a request carrying a timestamp without an offset, or a number, is now a 400 — send ISO-8601 with
  an offset. Domain services that accepted an ISO string from a controller should take a `Date`.
  `date`, `time` and `year` columns are unaffected (they carry no offset).

- **`@injitools/auth` — date columns are now `timestamptz` (changes the database schema).**
  `UserSessionOrm` (`last_seen`, `created_at`, `updated_at`, `expires_at`), `LoginTokenOrm`
  (`expires_at`, `created_at`) and `ApiKeyOrm` (`last_seen`) declared no explicit column type, so
  TypeORM fell back to the Postgres driver default `timestamp` — a naive wall-clock value with no
  offset, which drifts once the app server and the database sit in different zones. They are now
  `timestamptz`. **If you already have `user_sessions`, `login_tokens` or `api_keys` tables, this
  needs a migration:** Postgres reinterprets existing values by the session's `TimeZone` on
  `ALTER TABLE ... ALTER COLUMN ... TYPE timestamptz`, so set it explicitly (e.g.
  `SET TIME ZONE 'UTC'`) to control how naive timestamps are read.
- **`@injitools/auth`, `@injitools/cli` — entities no longer restate types the TS type already
  implies.** `@Column({type: 'varchar', length: 64})` → `@Column({length: 64})`, and likewise for
  `boolean`/`int`. TypeORM infers these from the property's TS type via `emitDecoratorMetadata`
  (already required by this framework — see the README). **This does not change the database schema
  or the generated API contract:** both the normalized column type and the emitted JSON Schema are
  identical either way, `length` limits included. Explicit types remain where inference can't reach
  them: `text`, `timestamptz`, `bigint`, `jsonb`, `uuid`, `enum`.

### Added

- **`@injitools/db` — documented column conventions** (`packages/db/README.md`): which column types
  are redundant to spell out, which must stay explicit, and why every date column has to be
  timezone-aware.
- **`@injitools/db` — tests covering ORM type inference.** `generateOrmZodValidation()` receives
  the TS constructor (`String`/`Number`/`Boolean`/`Date`) rather than a string alias when a column
  omits `type`. That path is what the scaffold now relies on, and it had no coverage; the new tests
  pin both forms to an identical JSON Schema.

### Fixed

- **`@injitools/auth` — `ApiKeyOrm.last_seen` silently had no timezone.** It declared no column
  type at all, making it `timestamp without time zone`. See the migration note above.

## [0.1.0] - 2026-07-16

Initial public release of Inji on npm: `@injitools/contract`, `@injitools/core`, `@injitools/db`,
`@injitools/auth` and `@injitools/cli`.

- **`@injitools/core`** — declarative router, DTO/Zod validation, OpenAPI 3.1 generation, middleware
  wiring and the error hierarchy. No database dependency.
- **`@injitools/contract`** — the DTO/validation layer, free of server dependencies (zod +
  reflect-metadata only), guarded by layering tests.
- **`@injitools/db`** — TypeORM integration: `@OrmLink` derivation from column metadata in both
  directions, `dbConnect`, value transformers.
- **`@injitools/auth`** — cookie sessions, Bearer keys, magic-link tokens, parameterized user
  identity, hashed token storage.
- **`@injitools/cli`** — `inji init`, scaffolding an API-first, app-centric monorepo (API + web +
  shadcn admin).

[Unreleased]: https://github.com/injitools/inji/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/injitools/inji/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/injitools/inji/releases/tag/v0.1.0
