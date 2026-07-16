import "reflect-metadata";

import {resolve} from "node:path";

import {InjiRouter} from "@injitools/core";
import {emitSchema} from "@injitools/core/codegen";

import {dbMain} from "@app/domain/db/dataSource";

import AuthApi from "./api/Endpoints/AuthApi.js";
import NewsAdminApi from "./api/Endpoints/NewsAdminApi.js";
import UsersApi from "./api/Endpoints/UsersApi.js";

// admin schema ← this app's own router (admin auth + news CRUD + users). NO live DB is required:
// @OrmLink derives from column metadata, which TypeORM builds OFFLINE with buildMetadatas() (no
// connection, no running Postgres). cwd = apps/admin/admin-api → ../admin-web.
await (dbMain as any).buildMetadatas();

const TARGET = resolve(process.cwd(), "../admin-web/src/api/schema.gen.ts");

const port = Number(process.env.ADMIN_API_PORT ?? 3301);
emitSchema(new InjiRouter([AuthApi, NewsAdminApi, UsersApi]), TARGET, {
    title: "__PROJECT_NAME__ Admin API",
    port,
});
