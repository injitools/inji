// Unit tests for request construction by the fetch client on a fake transport — no network.
// We verify argument distribution across sources (@Body/@Query/@Path), credentials/headers,
// response parsing (JSON/text), and error behavior.
import {describe, test, expect, vi} from "vitest";
import {createApiClient, createFetchClient, ApiClientError, type FetchLike} from "@injitools/core";
import {EchoApi} from "./fixtures/api-controllers.js";

/** Fake transport builder: records the request and returns the given response. */
function fakeTransport(response: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    contentType?: string | null;
    json?: any;
    text?: string;
}) {
    const calls: {url: string; init: any}[] = [];
    const fetchImpl: FetchLike = vi.fn(async (url, init) => {
        calls.push({url, init});
        return {
            ok: response.ok ?? true,
            status: response.status ?? 200,
            statusText: response.statusText ?? "OK",
            headers: {
                get: (name: string) =>
                    name.toLowerCase() === "content-type" ? (response.contentType ?? "application/json") : null,
            },
            json: async () => response.json,
            text: async () => response.text ?? "",
        };
    });
    return {fetchImpl, calls};
}

describe("argument distribution across parameter sources", () => {
    test("@Body → JSON body + content-type, POST method, correct URL", async () => {
        const {fetchImpl, calls} = fakeTransport({json: {text: "hi", repeated: "hihi"}});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl});

        const res = await client.create({text: "hi", times: 2});

        expect(calls).toHaveLength(1);
        // @Post() with no explicit path → default path = method name (see the Method decorator).
        expect(calls[0].url).toBe("http://api.test/echo/create");
        expect(calls[0].init.method).toBe("POST");
        expect(calls[0].init.headers["content-type"]).toBe("application/json");
        expect(JSON.parse(calls[0].init.body)).toEqual({text: "hi", times: 2});
        expect(res).toEqual({text: "hi", repeated: "hihi"});
    });

    test("@Path is interpolated into the path, @Query → querystring, GET without a body", async () => {
        const {fetchImpl, calls} = fakeTransport({json: {text: "42", repeated: "foo:5"}});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl});

        await client.find("42", {term: "foo", limit: 5});

        const {url, init} = calls[0];
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        // path: :id → 42; query: term + limit
        expect(url.startsWith("http://api.test/echo/item/42?")).toBe(true);
        const qs = new URL(url).searchParams;
        expect(qs.get("term")).toBe("foo");
        expect(qs.get("limit")).toBe("5");
    });

    test("@Path encodes special characters (encodeURIComponent)", async () => {
        const {fetchImpl, calls} = fakeTransport({json: {}});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl});

        await client.find("a/b c", {term: "x"});

        expect(calls[0].url.startsWith("http://api.test/echo/item/a%2Fb%20c")).toBe(true);
    });

    test("an optional @Query parameter is omitted from the querystring when not provided", async () => {
        const {fetchImpl, calls} = fakeTransport({json: {}});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl});

        await client.find("1", {term: "only"});

        const qs = new URL(calls[0].url).searchParams;
        expect(qs.has("limit")).toBe(false);
    });
});

describe("credentials and headers", () => {
    test("options.credentials is passed into the request init", async () => {
        const {fetchImpl, calls} = fakeTransport({json: {}});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl, credentials: "include"});

        await client.ping();

        expect(calls[0].init.credentials).toBe("include");
    });

    test("static options.headers (Bearer) end up in the request", async () => {
        const {fetchImpl, calls} = fakeTransport({contentType: "text/plain", text: "pong"});
        const client = createApiClient("http://api.test", EchoApi, {
            fetch: fetchImpl,
            headers: {authorization: "Bearer t0ken"},
        });

        await client.ping();

        expect(calls[0].init.headers.authorization).toBe("Bearer t0ken");
    });

    test("a headers factory (async) is computed on every request", async () => {
        const {fetchImpl, calls} = fakeTransport({json: {}});
        let n = 0;
        const client = createApiClient("http://api.test", EchoApi, {
            fetch: fetchImpl,
            headers: async () => ({authorization: `Bearer ${++n}`}),
        });

        await client.ping();
        await client.ping();

        expect(calls[0].init.headers.authorization).toBe("Bearer 1");
        expect(calls[1].init.headers.authorization).toBe("Bearer 2");
    });
});

describe("response parsing and errors", () => {
    test("text/plain → a string is returned", async () => {
        const {fetchImpl} = fakeTransport({contentType: "text/plain", text: "pong"});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl});

        expect(await client.ping()).toBe("pong");
    });

    test("non-2xx → ApiClientError with status and parsed body", async () => {
        const {fetchImpl} = fakeTransport({
            ok: false,
            status: 422,
            statusText: "Unprocessable Entity",
            json: {error: "bad"},
        });
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl});

        const err = await client.create({text: "", times: 1}).catch((e) => e);
        expect(err).toBeInstanceOf(ApiClientError);
        expect(err.status).toBe(422);
        expect(err.body).toEqual({error: "bad"});
    });

    test("createFetchClient — an alias for createApiClient", () => {
        expect(createFetchClient).toBe(createApiClient);
    });
});

describe("edge cases", () => {
    test("a class without @Router → a clear error", () => {
        class NotARouter {}
        expect(() => createApiClient("http://api.test", NotARouter as any)).toThrow(/is not registered/);
    });

    test("no global fetch and no options.fetch passed → error", () => {
        const saved = (globalThis as any).fetch;
        (globalThis as any).fetch = undefined;
        try {
            expect(() => createApiClient("http://api.test", EchoApi)).toThrow(/fetch is unavailable/);
        } finally {
            (globalThis as any).fetch = saved;
        }
    });

    test("accessing a nonexistent method → undefined (not a function)", () => {
        const {fetchImpl} = fakeTransport({json: {}});
        const client = createApiClient("http://api.test", EchoApi, {fetch: fetchImpl}) as any;
        expect(client.nope).toBeUndefined();
    });
});
