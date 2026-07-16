# @injitools/auth

Batteries-included auth for the **Inji** framework: cookie sessions and Bearer API keys on
TypeORM, with OpenAPI-aware middleware. Parameterized by the user identity type; secrets are
stored hashed.

Part of the [Inji](../../README.md) monorepo.

## Install

```bash
npm install @injitools/auth express typeorm
```

`express` and `typeorm` are peer dependencies.

## Usage

```ts
import {SessionService, MagicLinkService, createCookieAuth} from "@injitools/auth";

const sessions = new SessionService(db, {hashTokens: true}); // DB stores sha256(sid) only
const {sid, cookie} = await sessions.createSession(userId);

// one-time login tokens
const magic = new MagicLinkService(db, sessions);
const {token} = await magic.requestLogin(userId);            // send in a link/email
await magic.verifyLogin(token);                              // single-use → session
```

The identity type defaults to `bigint`; supply your own session entity with `user_id: string`
for UUIDs. See the [monorepo README](../../README.md) for details.

## License

MIT
