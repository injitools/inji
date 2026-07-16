// issue #4 — acceptance criterion: an invalid request → the response matches ErrorResponseDto
// {error, message, payload, inherit} and contains per-field errors in payload.fieldErrors.
//
// We spin up a real express + InjiRouter([EchoApi]) + errorMiddleware and send a "raw" fetch
// (not through the client — we need the whole response body) to verify the format over the wire.
import {describe, test, expect, beforeAll, afterAll} from "vitest";
import express from "express";
import type {AddressInfo} from "node:net";
import type {Server} from "node:http";
import {InjiRouter, errorMiddleware} from "@injitools/core";
import {EchoApi} from "./fixtures/api-controllers.js";

let server: Server;
let host: string;

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(new InjiRouter([EchoApi]).toExpressRouter());
    app.use(errorMiddleware);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

describe("validation error response format (ErrorResponseDto)", () => {
    test("invalid body → 400 + envelope {error,message,payload,inherit} with fieldErrors", async () => {
        // times is required (number) — omitting it breaks strictObject validation of EchoDto.
        const res = await fetch(`${host}/echo/create`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({text: "x"}),
        });
        expect(res.status).toBe(400);
        const body = await res.json();

        // The envelope matches ErrorResponseDto.
        expect(Object.keys(body).sort()).toEqual(["error", "inherit", "message", "payload"]);
        expect(body.error).toBe("ZodValidationError");
        expect(typeof body.message).toBe("string");
        // Inheritance hierarchy: ZodValidationError → ValidationError → RequestError.
        expect(body.inherit).toContain("ValidationError");

        // payload carries {formErrors, fieldErrors} with an error for a specific field.
        expect(Array.isArray(body.payload.formErrors)).toBe(true);
        expect(body.payload.fieldErrors).toHaveProperty("times");
        expect(body.payload.fieldErrors.times.length).toBeGreaterThan(0);
    });

    test("strictObject rejects an extra key → the error ends up in formErrors", async () => {
        const res = await fetch(`${host}/echo/create`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({text: "x", times: 2, bogus: true}),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.payload.formErrors.length).toBeGreaterThan(0);
    });
});
