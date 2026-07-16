import {z} from "zod";
import {env} from "@injitools/core/runtime";

// Imported for its side effect: on load, the dataSource module reads the shared .env from the
// monorepo root (process.loadEnvFile with an absolute path) — so the environment variables are
// already available by the time env() is read below, regardless of the process cwd.
import "@app/domain/db/dataSource";

// admin process config. Default port 3301 (client-api holds 3300).
export const PORT = env("ADMIN_API_PORT", 3301, z.coerce.number().int());

// Allowed origins of the admin frontend — for CORS with credentials (cookie sessions).
export const ADMIN_ORIGINS = (process.env.ADMIN_ORIGINS ?? "http://localhost:5174")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
