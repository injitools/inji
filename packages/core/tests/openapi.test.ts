// issue #10 — correctness of Router.toOpenApi(): paths, methods, requestBody/params from sources,
// ":id" → "{id}" conversion, responses and security schemes from middleware.
import "reflect-metadata";
import {describe, test, expect} from "vitest";
import {
    Router, Get, Post, Body, Response, Middleware, createMiddleware, InjiRouter,
    RequestDto, DtoProperty, ErrorResponseDto, buildOpenApiDocument,
} from "@injitools/core";
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

// The runtime validates every declared input and turns a failure into a ZodValidationError → 400.
// The spec has to say so on its own: a hand-kept list drifts away from the code (the skeleton used
// to document a 422 that nothing could return, while the 400 it does return was undeclared).
describe("400 for a validated input is declared by the route itself", () => {
    @RequestDto()
    class CreateBody {
        @DtoProperty() title!: string;
    }

    const rateLimited = createMiddleware((_req: any, _res: any, next: any) => next())
        .responses({code: 429, description: "Too Many Requests", type: ErrorResponseDto});

    @Router("auto")
    class AutoApi {
        // Has a @Body → validated → 400 is reachable.
        @Post("create")
        @Response(200, String)
        create(@Body() _body: CreateBody): string {
            return "ok";
        }

        // No inputs at all → nothing can fail validation → no 400.
        @Get("ping")
        @Response(200, String)
        ping(): string {
            return "pong";
        }

        // An explicit 400 must win over the generated one, and not be duplicated by it.
        @Post("explicit")
        @Response(200, String)
        @Response(400, ErrorResponseDto, "Пользовательское описание")
        explicit(@Body() _body: CreateBody): string {
            return "ok";
        }

        // A middleware declaring the same code as the controller must not produce anyOf[X, X].
        @Post("limited")
        @Middleware(rateLimited)
        @Response(200, String)
        @Response(429, ErrorResponseDto)
        limited(@Body() _body: CreateBody): string {
            return "ok";
        }
    }

    // Assert on the BUILT document, not on toOpenApi(): that one still returns zod schemas, and a
    // ZodUnion has no `.anyOf` property — so checking `schema.anyOf` there passes even when the spec
    // is wrong. The JSON Schema only exists after createDocument().
    const doc: any = buildOpenApiDocument(new InjiRouter([AutoApi]) as any, {title: "t", port: 1});
    const op = (p: string, m: string) => doc.paths[p][m];

    test("a route with a validated input declares 400", () => {
        const r = op("/auto/create", "post").responses["400"];
        expect(r).toBeDefined();
        expect(r.description).toBe("Validation Error");
        expect(r.content["application/json"].schema).toEqual({$ref: "#/components/schemas/ErrorResponseDto"});
    });

    test("a route with no inputs does not claim a 400 it cannot return", () => {
        expect(op("/auto/ping", "get").responses["400"]).toBeUndefined();
    });

    test("an explicit @Response(400) wins and is not duplicated", () => {
        const r = op("/auto/explicit", "post").responses["400"];
        expect(r.description).toBe("Пользовательское описание");
        expect(r.content["application/json"].schema.anyOf).toBeUndefined();
    });

    test("the same code from a middleware and the controller collapses into one schema", () => {
        const r = op("/auto/limited", "post").responses["429"];
        expect(r.content["application/json"].schema.anyOf, "429 declared twice must not become anyOf[X, X]")
            .toBeUndefined();
        expect(r.content["application/json"].schema).toEqual({$ref: "#/components/schemas/ErrorResponseDto"});
    });

    test("a description from a middleware survives when the controller declares the code bare", () => {
        expect(op("/auto/limited", "post").responses["429"].description).toBe("Too Many Requests");
    });
});
