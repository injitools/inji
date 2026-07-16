import "reflect-metadata";

import {randomBytes} from "node:crypto";

import {dbConnect, dbClose} from "@injitools/db";

import {dbMain} from "./db/dataSource.js";
import UserOrm from "./db/entities/UserOrm.js";
import NewsOrm from "./db/entities/NewsOrm.js";
import {hashPassword} from "./auth/password.js";

// Seeds the DB for development: an administrator + demo news items.
// Run: npm run seed   (from the root) or  npm run seed -w @app/domain
// The monorepo root .env is picked up when dbMain is imported (see db/dataSource.ts).

await dbConnect(dbMain);

let admin = await dbMain.manager.findOneBy(UserOrm, {login: "admin"} as any);
if (!admin) {
    // A random password by default (never a hardcoded one) — printed once, right here.
    // Set SEED_ADMIN_PASSWORD in the environment to pin a known password instead.
    const generated = !process.env.SEED_ADMIN_PASSWORD;
    const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(12).toString("base64url");
    admin = dbMain.manager.create(UserOrm, {
        login: "admin",
        name: "Administrator",
        password_hash: hashPassword(password),
        role: "admin",
    } as any);
    await dbMain.manager.save(admin);
    console.log(`seed: administrator created  login=admin  password=${password}`);
    if (generated) console.log("seed: ^ generated random admin password — copy it now, it is shown only once");
} else {
    console.log("seed: administrator already exists");
}

const newsCount = await dbMain.manager.count(NewsOrm);
if (newsCount === 0) {
    // Scheduled news item: a draft with publish_at one minute out — the publisher worker
    // flips it to published on a cron schedule (see apps/publisher).
    const inOneMinute = new Date(Date.now() + 60_000);
    await dbMain.manager.save(dbMain.manager.create(NewsOrm, [
        {title: "Project launch", body: "We have launched a new project on the Inji framework.", published: true, author: admin.name},
        {title: "Roadmap", body: "New sections and features are coming soon.", published: true, author: admin.name},
        {title: "Draft", body: "This news item is not published yet — visible only in the admin panel.", published: false, author: admin.name},
        {title: "Scheduled announcement", body: "This news item will be published automatically in a minute by the publisher worker.", published: false, publish_at: inOneMinute, author: admin.name},
    ] as any));
    console.log("seed: demo news items added (including a scheduled one)");
} else {
    console.log("seed: news items already exist, skipping");
}

await dbClose(dbMain);
console.log("seed: done");
