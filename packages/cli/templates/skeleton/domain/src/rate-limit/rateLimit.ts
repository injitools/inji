import {createRateLimit} from "@injitools/auth";

import {dbMain} from "../db/dataSource.js";

// Generic per-endpoint rate limit, bound to our DataSource. The guard and its append-and-count
// storage live in @injitools/auth (RateLimitOrm) — here we only bind them to dbMain.
//
// Decorate any endpoint: @RateLimit({bucket: "register", limit: 5, windowMs: 60 * 60 * 1000}).
// Clear counters with `npm run ratelimit:reset` (optionally `-- <bucket>`), see rateLimitReset.ts.
export const {RateLimit, reset: resetRateLimit} = createRateLimit(dbMain);
