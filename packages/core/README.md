# @injitools/core

Core of the **Inji** framework: a declarative router with DTO/Zod validation, OpenAPI 3.1
generation, middleware wiring and an error hierarchy. No database dependency.

Part of the [Inji](../../README.md) monorepo.

## Install

```bash
npm install @injitools/core
```

Requires `experimentalDecorators` + `emitDecoratorMetadata` in your `tsconfig.json`.

## Usage

```ts
import {Router, Get, Response, InjiRouter} from "@injitools/core";

@Router("hello")
class HelloApi {
  @Get()
  @Response(200, String)
  index() { return "Hello"; }
}

const router = new InjiRouter([HelloApi]);
app.use(router.toExpressRouter()); // Express router
router.toOpenApi();                // OpenAPI 3.1 spec
```

## Entry points

- `@injitools/core` — router, `RequestDto`/`ResponseDto` and validation decorators, error
  middleware, `buildOpenApiDocument` (router → OpenAPI 3.1 doc), and `createApiClient`/`createFetchClient`
  (an inter-server client between backends).
- `@injitools/core/codegen` — `emitSchema` (router → generated `schema.gen.ts` TS interfaces for
  frontends). A separate subpath (uses `node:fs`) so runtime servers don't pull in the generator.
  Needs only ORM metadata — run it offline via TypeORM's `buildMetadatas()`, no DB connection.
- `@injitools/core/runtime` — `env`, `Config`, `loadEnv`, environment helpers.
- `@injitools/core/lifecycle` — `makeProcess`, graceful shutdown.

See the [monorepo README](../../README.md) for the full picture.

## License

MIT
