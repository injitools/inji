import "reflect-metadata";

import {resolve} from "node:path";

import {InjiRouter} from "@injitools/core";
import {emitSchema} from "@injitools/core/codegen";

import {dbMain} from "@app/domain/db/dataSource";

import AuthApi from "./api/Endpoints/AuthApi.js";
import NewsApi from "./api/Endpoints/NewsApi.js";

// web schema ← this app's own router (auth + public news reads): only the types the public
// frontend needs. NO live DB is required: @OrmLink derives from column metadata, which TypeORM
// builds OFFLINE with buildMetadatas() (no connection, no running Postgres). cwd = apps/client/client-api → ../client-web.
await (dbMain as any).buildMetadatas();

const TARGET = resolve(process.cwd(), "../client-web/src/api/schema.gen.ts");

const port = Number(process.env.API_PORT ?? 3300);
emitSchema(new InjiRouter([AuthApi, NewsApi]), TARGET, {title: "__PROJECT_NAME__ API", port});
