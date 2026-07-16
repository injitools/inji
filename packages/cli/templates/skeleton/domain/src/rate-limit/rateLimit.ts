// Fixed-window rate limiter as a guard decorator. DB-backed (see RateLimitOrm) so the limit holds
// across process restarts and can be cleared with `npm run ratelimit:reset`. Keyed by bucket +
// client IP; on overflow the request is rejected with 429 BEFORE the handler runs — the same
// pattern as the @RequireUser/@RequireAdmin guards (a thin middleware that also enriches OpenAPI).
//
// Lives in domain because, like the auth guards, it is shared infra: any app can decorate any
// endpoint with @RateLimit(...) and all counters share one table.

import {Middleware, createMiddleware, ErrorResponseDto, RequestError} from "@injitools/core";

import {dbMain} from "../db/dataSource.js";
import RateLimitOrm from "../db/entities/RateLimitOrm.js";

export interface RateLimitOptions {
    /** Bucket name — part of the key so different endpoints count independently (e.g. "register"). */
    bucket: string;
    /** Max requests allowed within one window. */
    limit: number;
    /** Window length in ms (e.g. 60 * 60 * 1000 for an hourly limit). */
    windowMs: number;
}

// req.ip honours Express `trust proxy` when configured; otherwise fall back to the socket address.
function clientIp(req: any): string {
    return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Records one hit for (bucket, id) and reports whether it is within the limit.
 * Note: a plain read-modify-write, adequate for a starter. Under heavy concurrency from a single IP
 * a few extra requests may slip through; swap for an atomic UPDATE if you need a hard guarantee.
 */
export async function hitRateLimit(bucket: string, id: string, limit: number, windowMs: number): Promise<boolean> {
    const key = `${bucket}:${id}`;
    const now = new Date();
    const rec = await dbMain.manager.findOneBy(RateLimitOrm, {key} as any);

    if (!rec || now.getTime() - rec.window_start.getTime() >= windowMs) {
        // No record yet, or the previous window has elapsed → start a fresh window at count 1.
        await dbMain.manager.save(dbMain.manager.create(RateLimitOrm, {key, count: 1, window_start: now} as any));
        return true;
    }
    if (rec.count >= limit) return false;
    rec.count += 1;
    await dbMain.manager.save(rec);
    return true;
}

/**
 * Guard: fixed-window rate limit per client IP. Once `limit` requests occur within the same
 * `windowMs` window the endpoint answers 429 until the window rolls over. Clear counters with
 * `npm run ratelimit:reset` (optionally `-- <bucket>`).
 */
export function RateLimit(opts: RateLimitOptions): MethodDecorator {
    const handler = async (req: any, _res: any, next: (err?: unknown) => void) => {
        try {
            const ok = await hitRateLimit(opts.bucket, clientIp(req), opts.limit, opts.windowMs);
            if (!ok) throw new RequestError(429, "Too many requests, please try again later", "TooManyRequests");
            next();
        } catch (e) {
            next(e);
        }
    };
    const mw = createMiddleware(handler)
        .responses({code: 429, description: "Too Many Requests", type: ErrorResponseDto});
    return Middleware(mw);
}
