// issue #6 — type-level proof of parameterizable identity WITHOUT `as any`.
// Checked by vitest --typecheck (strict tsconfig.typecheck.json).
import {expectTypeOf, test} from "vitest";
import type {DataSource} from "typeorm";

import {SessionService, MagicLinkService} from "@injitools/auth";
import {UuidUserSessionOrm, UuidLoginTokenOrm} from "./fixtures/uuid-entities.js";

declare const db: DataSource;

test("default: createSession expects bigint, getSession returns user_id: bigint", () => {
    const svc = new SessionService(db);
    expectTypeOf(svc.createSession).parameter(0).toEqualTypeOf<bigint>();
});

test("UUID: SessionService<string> accepts string and returns user_id: string — without as any", () => {
    const svc = new SessionService<string>(db, {sessionEntity: UuidUserSessionOrm, hashTokens: true});
    expectTypeOf(svc.createSession).parameter(0).toEqualTypeOf<string>();
    // @ts-expect-error — bigint is not allowed where the identity is string.
    void svc.createSession(1n);
});

test("MagicLinkService<string> with a UUID token and SessionService<string>", () => {
    const sessions = new SessionService<string>(db, {sessionEntity: UuidUserSessionOrm});
    const magic = new MagicLinkService<string>(db, sessions, {tokenEntity: UuidLoginTokenOrm});
    expectTypeOf(magic.requestLogin).parameter(0).toEqualTypeOf<string>();
});
