import {createDocument} from "zod-openapi";

import type InjiRouter from "../router/Router.js";

export interface OpenApiOptions {
    title: string;
    port: number;
    version?: string;
}

// Builds an OpenAPI 3.1 document from an InjiRouter. Used both by servers (to serve Swagger UI
// and /openapi.json) and by the codegen tool (emitSchema) that generates TS interfaces for frontends.
// The return type is annotated explicitly (ReturnType) — otherwise tsc cannot name the internal
// zod-openapi type when emitting .d.ts (TS2742).
export function buildOpenApiDocument(router: InjiRouter, opts: OpenApiOptions): ReturnType<typeof createDocument> {
    return createDocument({
        openapi: "3.1.0",
        info: {title: opts.title, version: opts.version ?? "1.0.0"},
        servers: [{url: `http://localhost:${opts.port}`}],
        ...router.toOpenApi(),
    });
}
