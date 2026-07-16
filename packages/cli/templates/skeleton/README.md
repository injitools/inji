# __PROJECT_NAME__

A monorepo starter built on the **Inji** framework, following an **API-first, app-centric**
principle: the API (Express + Zod + TypeORM, automatic OpenAPI generation) is the single source of
truth. DTOs and their validation are **derived from ORM entities**, while the client-facing web app
and the admin panel, built on **shadcn/ui + React**, are typed with **interfaces generated from OpenAPI**.

The code is split into **domain** (the business core — entities + services, no controllers),
**apps** (self-contained runnable processes, each owning its own controllers and DTOs), and
**frontend** (the SPAs).

## Structure

```
__PROJECT_NAME__/
├─ domain/               @app/domain — BUSINESS CORE ONLY (shared by every app):
│   ├─ src/db/           entities (TypeORM) + DataSource (loads the shared .env from the root)
│   ├─ src/services/     domain services — the business logic (NewsService, UserService)
│   ├─ src/auth/         cookie sessions, passwords (scrypt), guard decorators (@RequireUser/@RequireAdmin)
│   └─ src/seed.ts       database seeding (admin + a generated password, printed once + demo news)
├─ apps/                 self-contained apps — each api owns its api/Endpoints + api/Dto + entry + codegen,
│  │                     its web frontend lives right next to it:
│  ├─ client/
│  │  ├─ client-api/     @app/client-api (:3300) — public: auth + public news feed (PUBLIC-projection DTOs)
│  │  └─ client-web/     @app/client-web — client-facing app (shadcn+React) → client-api :3300
│  ├─ admin/
│  │  ├─ admin-api/      @app/admin-api  (:3301) — admin-only auth + news CRUD + users (FULL-projection DTOs)
│  │  └─ admin-web/      @app/admin-web  — admin panel (shadcn+React) → admin-api :3301
│  └─ publisher/         @app/publisher — cron worker: schedules NewsService.publishDue()
├─ tsconfig.json         solution file: a single `tsc -b` builds domain + every app
├─ .env.example          shared .env for all apps (loaded from @app/domain)
└─ tsconfig.base.json    shared compiler options
```

### How it all fits together (API-first, app-centric)

1. **`@app/domain` is the business core — nothing else.** Entities (TypeORM), DataSource, domain
   services (`NewsService`, `UserService` — the business logic) and auth (cookie sessions,
   passwords, guards). **No controllers and no API DTOs live here.** It's wired into every app via
   TS project references (the root `tsconfig.json` is a solution file; `tsc -b` enforces the build
   order domain → apps).
2. **Each app is self-contained and owns its API.** An app under `apps/` declares its OWN
   controllers (`src/api/Endpoints`) and DTOs (`src/api/Dto`) and builds its own `InjiRouter`.
   **Apps never share controllers.** When two apps need the same operation, each declares its own
   endpoint and both delegate to the same domain service — the shared code is the service, not a
   controller. `client-api` (:3300) serves the public feed + login/register; `admin-api` (:3301)
   serves admin-only login + news CRUD + the user list. Even auth is per-app: they share
   `UserService.authenticate` + the cookie session, but `admin-api` enforces an admin-only login
   policy in its own controller.
3. **DTOs derive from TypeORM columns, and each app projects the entity differently.** `@RequestDto`
   (input) and `@ResponseDto` (output) bind an entity and pull fields via `@OrmLink`, each with its
   own direction semantics: `CreateNewsDto`'s `title` gets `max 200` from `varchar(200)`; a response
   `NewsDto` derives id/dates/flags from the same columns (dates as ISO strings, nullable → optional).
   The **client's** `NewsDto` is a public subset; the **admin's** `NewsDto` is the full record — same
   `NewsOrm`, two projections, one owned by each app. Because the runtime sends the return value as-is
   (`res.json`), each controller maps the entity into its DTO shape explicitly, so a public reader
   never receives admin-only fields.
4. **Authorization uses guard decorators, not checks inside the method body.** `@RequireUser()` and
   `@RequireAdmin()` (from `@app/domain`) are attached to a method as middleware: they validate the
   session BEFORE the handler, place the user in `req.meta.user` (read via `@Meta("user")`),
   and automatically add the cookie-session security scheme and 401/403 responses to OpenAPI.
5. **Each app serves OpenAPI automatically** (`/openapi.json`, Swagger UI at `/swagger`) from its own
   router.
6. **The frontends consume generated interfaces.** `npm run gen` builds each app's OpenAPI and writes
   `src/api/schema.gen.ts`: `web` ← the client-api router, `admin` ← the admin-api router. A thin
   `src/api.ts` (plain `fetch`) is typed with these interfaces. Codegen runs **offline**: `@OrmLink`
   needs only column metadata, which TypeORM builds with `buildMetadatas()` — **no DB connection and
   no running Postgres**. Change a DTO → `npm run gen` → the types update.
7. **`apps/publisher` is a background worker.** On a cron (period `PUBLISHER_PERIOD_MS`) it calls the
   domain `NewsService.publishDue()` — the business logic (publishing drafts whose `publish_at` has
   arrived) lives in the service; the worker only schedules it.

> The cookie session is shared through the database and visible on both ports (on `localhost` a cookie
> is not scoped by port). In production, different subdomains will need a `cookie domain` + matching CORS.

> Server-to-server communication is a separate story: `createApiClient`
> from `@injitools/core` builds a type-safe client straight from the controller class. That's for
> HTTP calls between backends, not for the browser.

## Requirements

- Node.js ≥ 21.7
- PostgreSQL (to RUN the apps: client-api, admin-api, publisher). Note: `npm run gen` does NOT need
  a running Postgres — it derives types from ORM metadata offline.
- Access to an npm registry with the `@injitools/*` packages (see `.npmrc`). If they aren't published yet —
  link them locally (the "Local framework development" section below).

## Running

```bash
npm install                                   # installs all workspaces
cp .env.example .env                           # shared .env at the root: Postgres access + NODE_ENV=dev
npm run seed                                   # creates the admin + demo news — PRINTS the generated admin password
npm run dev                                    # client-api + admin-api + publisher + web + admin
```

> `npm run seed` prints a **randomly generated** admin password (`login=admin`) exactly once — copy it.
> To pin a known password instead, set `SEED_ADMIN_PASSWORD` before seeding. There is no default password.

> `NODE_ENV=dev` (in `.env`) turns on TypeORM `synchronize` so the schema is auto-created on first run.
> In production leave it out and use migrations — auto-sync can silently alter/drop columns.

| Application | URL                           | Purpose                             |
|------------|-------------------------------|-------------------------------------|
| client-api | http://localhost:3300/swagger | public API (auth + public feed)     |
| admin-api  | http://localhost:3301/swagger | admin API (news CRUD + users)       |
| Publisher  | (background process)          | publishing scheduled news           |
| Web        | http://localhost:5173         | client-facing app → client-api      |
| Admin      | http://localhost:5174         | admin panel → admin-api (`admin` + the seeded password) |

`npm run dev` starts all processes via `concurrently` (a single shared `tsc -b -w` builds
domain and every app, then `node --watch` for each server + two Vite instances).
Individually: `npm run dev:client-api`, `npm run dev:admin-api`, `npm run dev:publisher`,
`npm run dev:web`, `npm run dev:admin`.

The generated interfaces (`schema.gen.ts`) are already committed to the repository, so the frontends
build right away. After changing a DTO, regenerate them (no running Postgres needed — codegen reads
ORM column metadata offline):

```bash
npm run gen        # overwrites apps/client/client-web/src/api/schema.gen.ts and apps/admin/admin-web/...
```

## Out-of-the-box features

- **Authentication** — registration/login via cookie session (`@injitools/auth` `SessionService`,
  `hashTokens` → only `sha256(sid)` in the database), passwords via scrypt. Access is gated by
  the guard decorators `@RequireUser`/`@RequireAdmin` (the `admin` role grants access to the admin panel).
- **News** — a public feed on web, full CRUD in the admin panel.
- **Scheduled publishing** — a news item has a `publish_at`; a draft with a future date
  is published by the `publisher` worker on schedule.
- **Users** — a list in the admin panel (admin role).
- **Rate limiting** — a DB-backed fixed-window guard `@RateLimit({bucket, limit, windowMs})` (from
  `@app/domain`). Applied to `POST /auth/register` at 5/hour per IP: registration must report *why* it
  fails (`409` when a login is taken), which also leaks which logins exist — the hourly cap blunts that
  enumeration and password brute-force. Clear the counters (e.g. after hitting the limit in dev) with:

  ```bash
  npm run ratelimit:reset            # all buckets
  npm run ratelimit:reset -- register  # just the register bucket
  ```
- **Derivation from the ORM** — `@RequestDto`/`@ResponseDto` + `@OrmLink` derive a Zod schema from
  column metadata in both directions; errors arrive as a unified `ErrorResponseDto` with
  `fieldErrors` for highlighting form fields (`isValidationErrorPayload`).

## Adding a shadcn component

```bash
cd apps/admin/admin-web   # or apps/client/client-web — the components.json config exists in both
npx shadcn@latest add dialog dropdown-menu
```

## Local framework development

If the `@injitools/*` packages aren't published to your registry yet — link them locally:

```bash
# in the inji-fast-start directory
npm install && npm run build
npm link -w @injitools/core -w @injitools/contract -w @injitools/db -w @injitools/auth

# in this project
npm link @injitools/core @injitools/contract @injitools/db @injitools/auth
```

> `@injitools/contract` is a transitive dependency of `@injitools/core` (its DTO/validation layer),
> and is linked along with the rest. The project itself doesn't import anything from it directly.
