import "reflect-metadata";

import {dbConnect, dbClose} from "@injitools/db";

import {dbMain} from "./db/dataSource.js";
import {resetRateLimit} from "./rate-limit/rateLimit.js";

// Clears generic @RateLimit counters — e.g. to unblock a developer who tripped the hourly register
// limit while testing. Run: npm run ratelimit:reset  (all buckets)
// or scope to one bucket:   npm run ratelimit:reset -- register
// The monorepo root .env is picked up when dbMain is imported (see db/dataSource.ts).

await dbConnect(dbMain);

const bucket = process.argv[2];
const cleared = await resetRateLimit(bucket);
console.log(bucket ? `ratelimit: cleared ${cleared} hit(s) for bucket "${bucket}"` : `ratelimit: cleared ${cleared} hit(s)`);

await dbClose(dbMain);
console.log("ratelimit: done");
