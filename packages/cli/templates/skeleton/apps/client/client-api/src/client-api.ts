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

import {PORT, WEB_ORIGINS} from "./config.js";
import AuthApi from "./api/Endpoints/AuthApi.js";
import NewsApi from "./api/Endpoints/NewsApi.js";

await dbConnect(dbMain);

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
// credentials:true + an explicit list of origins — required for cookie sessions from the browser.
app.use(cors({origin: WEB_ORIGINS, credentials: true}));

// Public process: this app's own controllers (auth + public news reads).
const router = new InjiRouter([AuthApi, NewsApi]);

// The same document from which codegen builds types for the web frontend.
const document = buildOpenApiDocument(router, {title: "__PROJECT_NAME__ API", port: PORT});
app.get("/openapi.json", (_req, res) => res.json(document));
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(null, {swaggerOptions: {url: "/openapi.json"}}));

app.use(router.toExpressRouter());
app.use(errorMiddleware);

app.listen(PORT, () => {
    console.log(`__PROJECT_NAME__ API → http://localhost:${PORT}/swagger`);
    console.log(`openapi → http://localhost:${PORT}/openapi.json`);
});
