# Inji

A declarative API framework on **Express + Zod + TypeORM** with **OpenAPI 3.1** auto-generation.
Extracted from a production monolith into a standalone set of packages.

One source of truth: decorated DTO classes produce both runtime validation (Zod) and the
OpenAPI spec. The documentation cannot drift away from the validation.

## Packages (npm workspaces)

| Package | Purpose |
|---------|---------|
| [`@injitools/core`](packages/core) | Core: declarative router, DTO/Zod validation, OpenAPI generation, middleware wiring, error hierarchy. No database dependency. |
| [`@injitools/db`](packages/db) | TypeORM integration: `@OrmLink` derivation (request & response) from column metadata, `dbConnect`, value transformers. |
| [`@injitools/auth`](packages/auth) | Batteries-included auth: cookie sessions and Bearer keys on TypeORM, OpenAPI-aware middleware factories. |
| [`@injitools/cli`](packages/cli) | CLI `inji init` — scaffolds a full monorepo (API + web + shadcn admin). |

## Quick start

```bash
# build every package
npm install
npm run build

# scaffold a new project
npx @injitools/cli init my-app   # → the `inji init` command
```

## The `inji init` scaffold (monorepo)

`inji init <name>` lays out a ready-to-run monorepo built around an **API-first, app-centric** principle:

```
<name>/
├─ domain/               business core ONLY: TypeORM entities + DataSource, domain services
│                        (NewsService/UserService — the business logic), auth (scrypt + sha256).
│                        No controllers, no API DTOs live here.
└─ apps/                 self-contained apps grouped by contour (api + its web side by side):
   ├─ client/
   │  ├─ client-api/     public process (feed, login, register); PUBLIC-projection DTOs
   │  └─ client-web/     client-facing app (React + Vite) → client-api
   ├─ admin/
   │  ├─ admin-api/      admin process (users, news CRUD); FULL-projection DTOs, admin-only auth
   │  └─ admin-web/      admin panel (shadcn/ui + React) → admin-api
   └─ publisher/         worker: schedules the domain NewsService.publishDue() operation
```

**The key idea (API-first, app-centric):** each app under `apps/` is self-contained — it owns its
controllers (`api/Endpoints`) and DTOs (`api/Dto`) and builds its own router. Apps never share
controllers; they reuse **domain services** (`NewsService`, `UserService`) — the single home of
the business logic. `domain` holds only that business layer plus the TypeORM entities.

TypeORM entity columns are the **single source of truth**: both `@RequestDto` (input) and
`@ResponseDto` (output) derive their fields from the columns via `@OrmLink`. Each app projects the
same entity differently — the client's `NewsDto` is a public subset, the admin's is the full
record — so a DTO is owned by the app, never shared. The API serves OpenAPI automatically, and the
frontends consume **TS interfaces generated from it** (`npm run gen` → `src/api/schema.gen.ts`)
through a thin fetch client — no hand-written frontend DTOs. codegen runs **offline** (TypeORM's
`buildMetadatas()` builds column metadata with no DB connection). Change a column → `npm run gen` →
the types update. (`createApiClient` from `@injitools/core` is for inter-server calls, not the browser.)

Out of the box: registration/login (an `admin` role for the admin app), a news section
(public feed + CRUD), a user list, and a single `ErrorResponseDto` with `fieldErrors` for
form highlighting.

## Dependency architecture

```
@injitools/core   -- pure core (express, zod, zod-openapi). No typeorm.
   ^   ^
   |   +-- @injitools/db    registers the ORM validation resolver into core via setOrmZodResolver()
   |          ^
   +--------  @injitools/auth   cookie/bearer + entities + SessionService
@injitools/cli    -- scaffold generator (no runtime dependencies)
```

The key decoupling trick: `@injitools/core` defines a `setOrmZodResolver()` hook, and
`@injitools/db` plugs `generateOrmZodValidation()` into it on import. This keeps the core free
of TypeORM while `@OrmLink` derivation works (in both directions) as soon as `@injitools/db` is present.

## A minimal controller

```ts
import {Router, Get, Post, Body, Response, InjiRouter} from "@injitools/core";

@Router("hello")
class HelloApi {
  @Get()
  @Response(200, String)
  index() { return "Hello"; }
}

const router = new InjiRouter([HelloApi]);
app.use(router.toExpressRouter());
// router.toOpenApi() → a ready OpenAPI spec
```

## Import cheatsheet

- `@injitools/core` — `Router` (decorator), `InjiRouter`/`ApiServer` (assembler class), `Get/Post/Put/Patch/Delete`,
  `Body/Query/Path/Headers/Meta/Req/Res/Next`, `RequestDto/ResponseDto` (the two DTO kinds),
  `DtoProperty/DtoLink/DtoLinkArray`, `Response`, `Middleware`, `createMiddleware`, `errorMiddleware`,
  `RequestError/ValidationError/ZodValidationError`, `generateZodValidation`, `setOrmZodResolver`,
  `buildOpenApiDocument` (router → OpenAPI 3.1 doc, for Swagger/openapi.json),
  `createApiClient`/`createFetchClient` (inter-server client), `ApiClientError`, the `RouterClient<R>` type.
- `@injitools/core/codegen` — `emitSchema` (router → generated `schema.gen.ts` TS interfaces). A
  separate subpath (uses `node:fs`) so runtime servers don't pull in the generator.
- `@injitools/core/runtime` — `env`, `Config`, `loadEnv`, `isDev/isProd/...`, `MPeriods/Periods`.
- `@injitools/core/lifecycle` — `makeProcess`, `stopServer`, graceful shutdown (registers signals on import).
- `@injitools/db` — `OrmLink` (+ deprecated `OrmDto`, now an alias of `RequestDto`), `dbConnect/dbClose`,
  `loadDbConfigFromEnv`, `findOrCreate/updateOrCreate`, `generateOrmZodValidation`,
  `BigTransformer/HexTransformer/IpTransformer`.
- `@injitools/auth` — `SessionService`, `MagicLinkService`, `createBearerAuth`, `createCookieAuth`,
  `User`, `Session`, `UserSessionOrm`, `ApiKeyOrm`, `LoginTokenOrm`, `AuthError`,
  `generateToken`, `sha256`.

## Request-DTO vs Response-DTO (both derive from ORM)

A DTO's **direction** is a first-class distinction — a single class is never reused for both:

- **`@RequestDto`** — an input body/query. `@OrmLink` fields derive with **input** semantics:
  generated/default/nullable columns become optional (a client omits what the server fills in),
  numbers/booleans coerce from the wire, and a date column takes an ISO-8601 string (with an
  offset) and hands the domain a `Date`. Non-column fields (a password) use `@DtoProperty`.
  `@OrmLink({extend})` refines a derived schema (add `.min()` to the column's `.max()`);
  `@OrmLink({validation})` replaces the derived type while keeping the field linked to the column.
- **`@ResponseDto`** — an output payload. `@OrmLink` fields derive with **output** semantics:
  a field is optional only when the column is nullable (generated/defaulted values are always
  present), and date columns are serialized as ISO strings. `@OrmLink({optional: true})` forces
  a field optional for partial DTOs (a PATCH body).

Both bind their entity via `@RequestDto(Orm, db)` / `@ResponseDto(Orm, db)`, so the TypeORM
column is the single source of truth in both directions — no hand-maintained field lists, and no
special DTOs authored for the frontend (it consumes the generated `schema.gen.ts`). Pure contract
DTOs with no table behind them (a login body, a message) use `@RequestDto()` / `@ResponseDto()`
with `@DtoProperty`.

**A DTO is owned by the app, and different apps project the same entity differently.** The public
`apps/client/client-api` exposes `NewsDto` as a public subset (no scheduling/updated meta); the
`apps/admin/admin-api` exposes its own fuller `NewsDto`. Same `NewsOrm`, two projections, one per app —
they are not shared. Because the runtime sends the handler's return value as-is (`res.json`), each
controller maps the entity into its app's DTO shape explicitly, so a public reader never receives
admin-only fields.

`@injitools/contract` holds this DTO/validation layer and stays free of server dependencies
(zod + reflect-metadata only) — layering hygiene, so `core`/`db`/`auth` build on it without
cycles. Two gates guard it: `tests/no-orm-leak.test.ts` (source scan) and `tests/graph.test.ts`
(built dist graph: only `zod` + `reflect-metadata`).

## The canonical error response

The server returns errors through `errorMiddleware` in a single `ErrorResponseDto` envelope
`{error, message, payload, inherit}`. The server imports it from `@injitools/core`, and the
frontends receive it as the generated `ErrorResponseDto` interface in `schema.gen.ts`, so the
response shape never diverges between layers.

For validation errors, `payload` carries a per-field breakdown `{formErrors, fieldErrors}` —
a Zod `flatten()`-style structure, ready for highlighting form fields:

On the server (or an inter-server `createApiClient` caller):

```ts
import {isValidationErrorPayload, ApiClientError} from "@injitools/core";

try {
  await client.User.create(form);
} catch (e) {
  if (e instanceof ApiClientError && isValidationErrorPayload(e.body?.payload)) {
    const {fieldErrors, formErrors} = e.body.payload; // {email: ["Invalid email"], ...}
  }
}
```

On the frontend the same `{formErrors, fieldErrors}` shape arrives as the generated
`ErrorResponseDto`; the thin `src/api.ts` provides a local `isValidationErrorPayload` guard.

## Reusable Zod primitives

Ready-made validators for `@DtoProperty({validation})` — no duplicated validation across DTOs:

```ts
import {RequestDto, DtoProperty, Uuid, Latitude, Longitude, IsoDateTime} from "@injitools/core";

@RequestDto()
class CheckinDto {
  @DtoProperty({validation: Uuid}) id: string;
  @DtoProperty({validation: Latitude}) lat: number;   // -90..90, coerced from query
  @DtoProperty({validation: Longitude}) lng: number;  // -180..180
  @DtoProperty({validation: IsoDateTime}) at: string; // ISO-8601 with offset
}
```

## Auth: identity, hashed storage, magic-link

`@injitools/auth` is parameterized by the user identity type and stores secrets hashed.

**Parameterized identity.** The default is `bigint` (the built-in `UserSessionOrm`). For UUIDs,
declare your own session entity with `user_id: string` and plug it in without casts:

```ts
@Entity("user_sessions")
class UuidUserSessionOrm implements SessionRecord<string> {
  @PrimaryColumn() sid: string;
  @Column({type: "uuid"}) user_id: string;
  /* data?, last_seen, expires_at, ... */
}

const sessions = new SessionService<string>(db, {sessionEntity: UuidUserSessionOrm});
await sessions.createSession("3f2504e0-...");   // userId: string — type-safe
```

**Hashed sid storage.** With `hashTokens: true`, the client receives the raw `sid` (in the
cookie) while the database stores only `sha256(sid)`. It mirrors `hashKey` from
`createBearerAuth`. The default is `false` (back-compat); enabling it is recommended for new apps.

```ts
const sessions = new SessionService(db, {hashTokens: true});
```

**Magic-link / one-time tokens.** `MagicLinkService` sits on top of `SessionService`:
`requestLogin` issues a token (the database keeps only `sha256`, with a TTL), and `verifyLogin`
atomically burns it (single-use) and creates a session.

```ts
const magic = new MagicLinkService(db, sessions);
const {token} = await magic.requestLogin(userId);   // send token in a link/email
const {sid, cookie} = await magic.verifyLogin(token); // single-use → session; reuse → AuthError
```

## Distribution: npm

The `@injitools/*` packages are published to the public npm registry:

```bash
npm install @injitools/core @injitools/db
```

The backends need a metadata-emitting toolchain for decorators (`experimentalDecorators` +
`emitDecoratorMetadata` in tsconfig; run through `tsc`/SWC, not esbuild/tsx). The **frontends do
not import any `@injitools/*` package** — they consume the generated `src/api/schema.gen.ts`
interfaces through a thin `fetch` client, so there are no framework decorators in the web bundle.

All packages are versioned in lockstep and released together from a single `v*.*.*` tag — see
[CHANGELOG.md](CHANGELOG.md).

## License

MIT
