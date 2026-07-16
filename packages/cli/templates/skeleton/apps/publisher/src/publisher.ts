import "reflect-metadata";

import {z} from "zod";

import {env} from "@injitools/core/runtime";
import {makeProcess, stopPromise} from "@injitools/core/lifecycle";
import {dbConnect, dbClose} from "@injitools/db";

// A backend process with no HTTP surface: it shares the @app/domain core with the APIs and drives
// a domain operation on a schedule. The business logic (publishing deferred drafts) lives in the
// domain NewsService — the worker only schedules it. Importing dbMain pulls in the shared .env from
// the monorepo root (see @app/domain/db/dataSource).
import {dbMain, NewsService} from "@app/domain";

const PERIOD = env("PUBLISHER_PERIOD_MS", 15000, z.coerce.number().int());

await dbConnect(dbMain);
console.log(`publisher: started, period ${PERIOD} ms`);

// makeProcess runs the job immediately and then every PERIOD ms. Importing @injitools/core/lifecycle
// registers SIGINT/SIGTERM handlers (graceful shutdown) — hence only at the entry point.
makeProcess("publish-due-news", async () => {
    const published = await NewsService.publishDue();
    if (published > 0) console.log(`publisher: published ${published} news items`);
}, PERIOD);

// Keep the process alive until the stop signal, then gracefully close the DB connection.
await stopPromise;
await dbClose(dbMain);
console.log("publisher: stopped");
