import type {
    AuthUserDto,
    MessageDto,
    NewsDto,
    LoginDto,
    RegisterDto,
    ErrorResponseDto,
} from "./api/schema.gen";

// Base API URL. credentials:"include" — the browser sends the session cookie to the api on a different port.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3300";

/** Parsed validation error (like Zod flatten): highlights form fields. */
export interface ValidationErrorPayload {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
}

export function isValidationErrorPayload(payload: unknown): payload is ValidationErrorPayload {
    return (
        !!payload &&
        typeof payload === "object" &&
        "fieldErrors" in payload &&
        "formErrors" in payload &&
        Array.isArray((payload as ValidationErrorPayload).formErrors)
    );
}

/** API error response (non-2xx). body — the canonical ErrorResponseDto, if the server returned one. */
export class ApiError extends Error {
    status: number;
    body?: ErrorResponseDto;

    constructor(status: number, body?: ErrorResponseDto) {
        super(body?.message ?? `HTTP ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

type Query = Record<string, string | number | boolean | undefined>;

async function request<T>(method: string, path: string, opts: {body?: unknown; query?: Query} = {}): Promise<T> {
    const url = new URL(API_URL + path);
    if (opts.query) {
        for (const [key, value] of Object.entries(opts.query)) {
            if (value !== undefined) url.searchParams.set(key, String(value));
        }
    }
    const hasBody = opts.body !== undefined;
    const res = await fetch(url, {
        method,
        credentials: "include",
        headers: hasBody ? {"Content-Type": "application/json"} : undefined,
        body: hasBody ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
        let body: ErrorResponseDto | undefined;
        try {
            body = (await res.json()) as ErrorResponseDto;
        } catch {
            /* body is not JSON — leave it undefined */
        }
        throw new ApiError(res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

// Typed calls grouped by area. Argument/response types come from the generated interfaces.
export const authApi = {
    register: (body: RegisterDto) => request<AuthUserDto>("POST", "/auth/register", {body}),
    login: (body: LoginDto) => request<AuthUserDto>("POST", "/auth/login", {body}),
    logout: () => request<MessageDto>("POST", "/auth/logout"),
    me: () => request<AuthUserDto>("GET", "/auth/me"),
};

export const newsApi = {
    list: (query?: {limit?: number; published?: boolean}) => request<NewsDto[]>("GET", "/news/list", {query}),
    get: (id: string) => request<NewsDto>("GET", `/news/${id}`),
};
