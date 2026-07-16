// Acceptance criterion: a real call to a running InjiRouter through the fetch client returns
// a typed response. We spin up a genuine express + InjiRouter([EchoApi]) on an ephemeral
// port and hit it with the same createApiClient via global fetch (Node ≥18).
//
// createApiClient is the inter-server (node↔node) client — the same controller class drives both
// the server (InjiRouter) and the typed client via the shared RoutesStorage singleton (no codegen).
import {describe, test, expect, beforeAll, afterAll} from "vitest";
import express from "express";
import type {AddressInfo} from "node:net";
import type {Server} from "node:http";
import {InjiRouter, createApiClient, errorMiddleware} from "@injitools/core";
import {EchoApi} from "./fixtures/api-controllers.js";

let server: Server;
let host: string;
let lastAuth: string | undefined; // the intercepted Authorization header of the last request

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    // Intercept Authorization before the router — verify the real Bearer pass-through over the wire
    // (the whole req.headers via @Headers is not possible: the DTO schemas are strict, z.strictObject).
    app.use((req, _res, next) => {
        lastAuth = req.headers["authorization"];
        next();
    });
    app.use(new InjiRouter([EchoApi]).toExpressRouter());
    app.use(errorMiddleware);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const {port} = server.address() as AddressInfo;
    host = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
    );
});

describe("real InjiRouter through the fetch client", () => {
    test("POST @Body → typed JSON response from a DTO", async () => {
        const client = createApiClient<EchoApi>(host, EchoApi);
        const res = await client.create({text: "ab", times: 3});
        expect(res).toEqual({text: "ab", repeated: "ababab"});
    });

    test("GET @Path + @Query: the path and query arrive, the query number is coerced by the server", async () => {
        const client = createApiClient<EchoApi>(host, EchoApi);
        const res = await client.find("X1", {term: "q", limit: 7});
        // find returns {text:id, repeated:`${term}:${limit}`}; limit arrived as a string and
        // was coerced to a number on the server — otherwise it would be "q:7" from a string, but that is the same string.
        expect(res).toEqual({text: "X1", repeated: "q:7"});
    });

    test("GET with no arguments → a text/plain string", async () => {
        const client = createApiClient<EchoApi>(host, EchoApi);
        expect(await client.ping()).toBe("pong");
    });

    test("options.headers (Bearer) actually reaches the server", async () => {
        lastAuth = undefined;
        const client = createApiClient<EchoApi>(host, EchoApi, {headers: {authorization: "Bearer real"}});
        await client.ping();
        expect(lastAuth).toBe("Bearer real");
    });

    test("server validation error → ApiClientError (non-2xx)", async () => {
        const client = createApiClient<EchoApi>(host, EchoApi);
        // times is required and must be a number — omitting it breaks strictObject validation.
        const err = await client.create({text: "x"} as any).catch((e) => e);
        expect(err?.name).toBe("ApiClientError");
        expect(err.status).toBeGreaterThanOrEqual(400);
    });
});
