// issue #10 — correctness of Router.toOpenApi(): paths, methods, requestBody/params from sources,
// ":id" → "{id}" conversion, responses and security schemes from middleware.
import "reflect-metadata";
import {describe, test, expect} from "vitest";
import {Router, Get, Response, Middleware, createMiddleware, InjiRouter} from "@injitools/core";
import {EchoApi} from "./fixtures/api-controllers.js";

// Controller with security middleware — verify collection of components.securitySchemes and security[].
const bearer = createMiddleware((_req: any, _res: any, next: any) => next())
    .security("bearerAuth", {type: "http", scheme: "bearer"});

@Router("secure")
class SecureApi {
    @Get("data")
    @Middleware(bearer)
    @Response(200, String)
    data(): string {
        return "ok";
    }
}

describe("Router.toOpenApi()", () => {
    const spec = new InjiRouter([EchoApi]).toOpenApi();

    test("paths are collected, ':param' is converted to '{param}'", () => {
        expect(Object.keys(spec.paths).sort()).toEqual(
            ["/echo/create", "/echo/item/{id}", "/echo/ping"].sort(),
        );
    });

    test("methods and tags are set", () => {
        expect(spec.paths["/echo/create"].post).toBeDefined();
        expect(spec.paths["/echo/item/{id}"].get).toBeDefined();
        expect(spec.paths["/echo/create"].post!.tags).toEqual(["echo"]);
    });

    test("@Body → requestBody.application/json with a schema", () => {
        const body = spec.paths["/echo/create"].post!.requestBody as any;
        expect(body.content["application/json"].schema).toBeDefined();
    });

    test("@Path → parameters[in=path, required], @Query → requestParams.query", () => {
        const op = spec.paths["/echo/item/{id}"].get as any;
        const idParam = op.parameters.find((p: any) => p.name === "id");
        expect(idParam).toMatchObject({in: "path", required: true});
        expect(op.requestParams.query).toBeDefined();
    });

    test("responses: 200 is present with content", () => {
        const op = spec.paths["/echo/create"].post as any;
        expect(op.responses["200"]).toBeDefined();
        expect(op.responses["200"].content).toBeDefined();
    });

    test("primitive String response → content text/html", () => {
        const op = spec.paths["/echo/ping"].get as any;
        expect(op.responses["200"].content["text/html"]).toBeDefined();
    });

    test("security scheme from middleware ends up in components and in the operation's security", () => {
        const secured = new InjiRouter([SecureApi]).toOpenApi();
        expect(secured.components?.securitySchemes?.bearerAuth).toMatchObject({type: "http", scheme: "bearer"});
        const op = secured.paths["/secure/data"].get as any;
        expect(op.security).toContainEqual({bearerAuth: []});
    });
});
