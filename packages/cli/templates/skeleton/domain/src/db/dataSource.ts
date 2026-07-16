import {existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import {DataSource} from "typeorm";

import {loadDbConfigFromEnv} from "@injitools/db";
import {UserSessionOrm} from "@injitools/auth";

import UserOrm from "./entities/UserOrm.js";
import NewsOrm from "./entities/NewsOrm.js";
import RateLimitOrm from "./entities/RateLimitOrm.js";

// .env lives at the ROOT of the monorepo and is shared by all backend processes (api, publisher):
// each of them has its own cwd, and loadEnv()/process.loadEnvFile read .env relative to cwd.
// So we load .env by an absolute path computed from this module's location.
// We do it here, before reading DB_MAIN_*: ESM evaluates a module on import — before the body
// of main.ts/seed.ts, so loading it there would happen too late.
// dist layout: domain/dist/db/dataSource.js → monorepo root = ../../../
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
const envFile = resolve(ROOT, ".env");
if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
    console.log(`[env] loaded ${envFile}`);
}

// The main DataSource. Config is read from environment variables with the DB_MAIN_ prefix.
export const dbMain = new DataSource({
    type: "postgres",
    ...loadDbConfigFromEnv("DB_MAIN_"),
    entities: [
        UserOrm,
        NewsOrm,
        RateLimitOrm,   // fixed-window rate-limit counters (see rate-limit/rateLimit.ts)
        UserSessionOrm, // ready-made cookie-session entity from @injitools/auth
    ],
    // Auto-sync the schema ONLY in dev (NODE_ENV=dev, set in .env). Never in production —
    // it can silently alter/drop columns; use migrations there instead.
    synchronize: process.env.NODE_ENV === "dev",
    logging: ["error", "warn"],
});
