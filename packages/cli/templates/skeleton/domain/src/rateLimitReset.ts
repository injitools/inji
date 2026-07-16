import "reflect-metadata";

import {dbConnect, dbClose} from "@injitools/db";

import {dbMain} from "./db/dataSource.js";
import RateLimitOrm from "./db/entities/RateLimitOrm.js";

// Clears fixed-window rate-limit counters — e.g. to unblock a developer who tripped the hourly
// registration limit while testing. Run: npm run ratelimit:reset  (all buckets)
// or scope to one bucket:            npm run ratelimit:reset -- register
// The monorepo root .env is picked up when dbMain is imported (see db/dataSource.ts).

await dbConnect(dbMain);

const bucket = process.argv[2];
if (bucket) {
    const res = await dbMain.manager
        .createQueryBuilder()
        .delete()
        .from(RateLimitOrm)
        .where("key LIKE :p", {p: `${bucket}:%`})
        .execute();
    console.log(`ratelimit: cleared ${res.affected ?? 0} entr${res.affected === 1 ? "y" : "ies"} for bucket "${bucket}"`);
} else {
    await dbMain.manager.clear(RateLimitOrm);
    console.log("ratelimit: cleared all counters");
}

await dbClose(dbMain);
console.log("ratelimit: done");
