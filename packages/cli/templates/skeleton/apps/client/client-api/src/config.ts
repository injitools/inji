import {z} from "zod";
import {env} from "@injitools/core/runtime";

// Imported for its side effect: on load, the dataSource module reads the shared .env from the
// monorepo root (process.loadEnvFile with an absolute path) — variables are available by the time env() runs below.
import "@app/domain/db/dataSource";

// public process config. Default port 3300 (the web frontend talks to it).
export const PORT = env("API_PORT", 3300, z.coerce.number().int());

// Allowed origins of the web frontend — for CORS with credentials (cookie sessions).
export const WEB_ORIGINS = (process.env.WEB_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
