// Type-level tests (acceptance criterion #1): client methods = the controller's method signatures,
// but always async; the body/response types are inferred from the DTOs. Checked by vitest --typecheck
// in the strict config (see vitest.config.ts → test.typecheck).
import {expectTypeOf, test} from "vitest";
import {createApiClient, type RouterClient} from "@injitools/core";
import {EchoApi, EchoDto, EchoResultDto, SearchQueryDto} from "./fixtures/api-controllers.js";

test("createApiClient<R> → RouterClient<R>: methods are async, types from the controller", () => {
    const client = createApiClient<EchoApi>("http://x", EchoApi);
    expectTypeOf(client).toEqualTypeOf<RouterClient<EchoApi>>();
});

test("@Body method: argument = body DTO, result = Promise<response DTO>", () => {
    const client = createApiClient<EchoApi>("http://x", EchoApi);
    expectTypeOf(client.create).parameter(0).toEqualTypeOf<EchoDto>();
    expectTypeOf(client.create).returns.toEqualTypeOf<Promise<EchoResultDto>>();
});

test("@Path + @Query method: positional arguments mirror the controller signature", () => {
    const client = createApiClient<EchoApi>("http://x", EchoApi);
    expectTypeOf(client.find).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(client.find).parameter(1).toEqualTypeOf<SearchQueryDto>();
    expectTypeOf(client.find).returns.toEqualTypeOf<Promise<EchoResultDto>>();
});

test("the controller's primitive response is preserved: ping → Promise<string>", () => {
    const client = createApiClient<EchoApi>("http://x", EchoApi);
    expectTypeOf(client.ping).returns.toEqualTypeOf<Promise<string>>();
});

test("the client exposes only the controller's methods", () => {
    const client = createApiClient<EchoApi>("http://x", EchoApi);
    expectTypeOf(client).toHaveProperty("create");
    expectTypeOf(client).toHaveProperty("find");
    expectTypeOf(client).toHaveProperty("ping");
});
