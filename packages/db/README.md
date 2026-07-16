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

## License

MIT
