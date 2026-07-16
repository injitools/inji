import "reflect-metadata";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import {InjiRouter, errorMiddleware, buildOpenApiDocument} from "@injitools/core";
import {dbConnect} from "@injitools/db";

// The business core lives in @app/domain (entities, DataSource, services, auth). Importing dbMain
// pulls in the shared .env from the monorepo root (see @app/domain/db/dataSource).
import {dbMain} from "@app/domain/db/dataSource";

import {PORT, ADMIN_ORIGINS} from "./config.js";
import AuthApi from "./api/Endpoints/AuthApi.js";
import NewsAdminApi from "./api/Endpoints/NewsAdminApi.js";
import UsersApi from "./api/Endpoints/UsersApi.js";

await dbConnect(dbMain);

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
// credentials:true + an explicit list of origins — required for cookie sessions from the browser.
app.use(cors({origin: ADMIN_ORIGINS, credentials: true}));

// admin process: this app's own controllers (admin auth + news CRUD + users).
const router = new InjiRouter([AuthApi, NewsAdminApi, UsersApi]);

// The same document from which codegen builds types for the admin frontend.
const document = buildOpenApiDocument(router, {title: "__PROJECT_NAME__ Admin API", port: PORT});
app.get("/openapi.json", (_req, res) => res.json(document));
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(null, {swaggerOptions: {url: "/openapi.json"}}));

app.use(router.toExpressRouter());
app.use(errorMiddleware);

app.listen(PORT, () => {
    console.log(`__PROJECT_NAME__ ADMIN API → http://localhost:${PORT}/swagger`);
    console.log(`openapi → http://localhost:${PORT}/openapi.json`);
});
