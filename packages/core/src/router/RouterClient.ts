import RoutesStorage, {TRouterMethodParam} from "./storages/RoutesStorage.js";
import {trimSlashes} from "../tools/String.js";

type AnyFn = (...args: any[]) => any;

type Ctor<T> = new (...args: any[]) => T;

type Asyncify<F> =
    F extends (...args: infer A) => infer R
        ? (...args: A) => Promise<Awaited<R>>
        : never;

/**
 * A type-safe HTTP client for a router class: the client's methods mirror the controller's method
 * signatures but always return a Promise. The server-side parameters (@Req/@Res/@Next/@Meta)
 * are preserved in the signature — on the client they are simply ignored when building the request.
 */
export type RouterClient<R> = {
    [K in keyof R as R[K] extends AnyFn ? K : never]: Asyncify<R[K]>;
};

// ── Structural transport contract ────────────────────────────────────────────
// We deliberately do NOT use DOM types (RequestInit/Response/Headers): the core tsconfig is built
// with lib=ES2022 without "dom", so these minimal structural types keep the client isomorphic —
// satisfied by Node's global fetch (≥18) for inter-server calls, or any custom transport.

export type RequestCredentials = "omit" | "same-origin" | "include";

export type FetchInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    credentials?: RequestCredentials;
};

export type FetchResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    headers: {get(name: string): string | null};
    json(): Promise<any>;
    text(): Promise<string>;
};

/** A Web Fetch API-level transport. The real fetch satisfies this type structurally. */
export type FetchLike = (input: string, init?: FetchInit) => Promise<FetchResponse>;

export type ApiClientOptions = {
    /** The transport. Defaults to globalThis.fetch. Override it for tests/interception/Node<18. */
    fetch?: FetchLike;
    /** cookie/credentials policy — for cookie sessions set this to "include". */
    credentials?: RequestCredentials;
    /**
     * Additional headers (e.g. Authorization: Bearer ...). Can be a static object
     * or a factory (sync/async) computed on every request — handy for tokens
     * that expire.
     */
    headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
};

/** A non-2xx response error. Carries the status and parsed body for handling on the web side. */
export class ApiClientError extends Error {
    constructor(
        readonly status: number,
        readonly statusText: string,
        readonly body: unknown,
    ) {
        super(`HTTP ${status} ${statusText}`);
        this.name = "ApiClientError";
    }
}

/** Joins path segments into a URL, collapsing redundant slashes (but leaving "scheme://" alone). */
function joinUrl(host: string, ...segments: string[]): string {
    const base = host.replace(/\/+$/, "");
    const tail = segments
        .map(s => trimSlashes(s))
        .filter(s => s !== "")
        .join("/");
    return tail ? `${base}/${tail}` : base;
}

/** Substitutes path variables (:key) from the parameter value. */
function applyPathParams(template: string, param: TRouterMethodParam, value: any): string {
    if (param.key) {
        return template.replace(new RegExp(`:${param.key}\\b`), encodeURIComponent(String(value)));
    }
    // @Params() without a key — the whole req.params object.
    let out = template;
    for (const [k, v] of Object.entries(value ?? {})) {
        out = out.replace(new RegExp(`:${k}\\b`), encodeURIComponent(String(v)));
    }
    return out;
}

/** Appends query parameters from an object (arrays are expanded into repeated keys). */
function appendQuery(query: URLSearchParams, value: any): void {
    if (value == null) return;
    for (const [k, v] of Object.entries(value)) {
        if (Array.isArray(v)) {
            for (const item of v) query.append(k, String(item));
        } else if (v != null) {
            query.set(k, String(v));
        }
    }
}

/** Parses the response by content-type: JSON → object, otherwise text. */
async function parseBody(res: FetchResponse): Promise<unknown> {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) return res.json();
    const text = await res.text();
    return text === "" ? undefined : text;
}

/**
 * Builds a type-safe fetch client from a controller class. The transport is Web Fetch
 * (globalThis.fetch by default), optionally overridable via options.fetch.
 * Browser-safe: does not depend on express/got/node-core.
 */
export function createApiClient<R>(host: string, Router: Ctor<R>, options: ApiClientOptions = {}): RouterClient<R> {
    const route = RoutesStorage.get(Router);
    if (!route) {
        throw new Error(`createApiClient: class ${Router?.name ?? String(Router)} is not registered with the @Router decorator`);
    }

    const transport: FetchLike = options.fetch ?? (globalThis as any).fetch;
    if (typeof transport !== "function") {
        throw new Error("createApiClient: global fetch is unavailable — pass options.fetch");
    }

    return new Proxy({} as RouterClient<R>, {
        get(_target, prop: string) {
            const method = route.methods[prop];
            if (!method) return undefined;

            return async (...args: any[]) => {
                let pathTemplate = joinUrl(host, route.path, method.path);
                const query = new URLSearchParams();
                const headers: Record<string, string> = {};
                let body: unknown;

                // Headers from options (Bearer, etc.) — static or computed per request.
                const optHeaders = typeof options.headers === "function" ? await options.headers() : options.headers;
                Object.assign(headers, optHeaders ?? {});

                // Distribute positional arguments across the controller's parameter sources.
                for (const param of method.params ?? []) {
                    if (!param) continue;
                    const value = args[param.index];
                    switch (param.source) {
                        case "body":
                            body = value;
                            break;
                        case "query":
                            appendQuery(query, value);
                            break;
                        case "params":
                            pathTemplate = applyPathParams(pathTemplate, param, value);
                            break;
                        case "headers":
                            Object.assign(headers, value ?? {});
                            break;
                        // req/res/next/meta — server-side, not sent from the client.
                    }
                }

                const qs = query.toString();
                const url = qs ? `${pathTemplate}?${qs}` : pathTemplate;

                const init: FetchInit = {method: method.method.toUpperCase(), headers};
                if (options.credentials) init.credentials = options.credentials;
                if (body !== undefined) {
                    headers["content-type"] = "application/json";
                    init.body = JSON.stringify(body);
                }

                const res = await transport(url, init);
                const parsed = await parseBody(res);
                if (!res.ok) throw new ApiClientError(res.status, res.statusText, parsed);
                return parsed;
            };
        },
    });
}

/** An explicit alias for createApiClient — emphasizes the fetch transport at the call site. */
export const createFetchClient = createApiClient;
