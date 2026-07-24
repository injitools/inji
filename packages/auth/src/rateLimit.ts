import {DataSource, EntityTarget} from "typeorm";
import {Middleware, createMiddleware, ErrorResponseDto, RequestError} from "@injitools/core";

import DefaultRateLimitOrm from "./entities/RateLimitOrm.js";

/** One recorded request hit. The app supplies the entity; the built-in RateLimitOrm matches it. */
export interface RateLimitHit {
    id: number | bigint | string;
    bucket: string;
    ip: string;
    created_at: Date;
}

export type RateLimitGuardOptions = {
    /** Bucket name — part of the key, so different endpoints count independently. */
    bucket: string;
    /** Max requests allowed within one window. */
    limit: number;
    /** Window length, ms (e.g. 60 * 60 * 1000 for hourly). */
    windowMs: number;
};

export type RateLimitFactoryOptions = {
    /** Hit entity. Defaults to the built-in RateLimitOrm. */
    hitEntity?: EntityTarget<RateLimitHit>;
    /** Clock override — only for tests. */
    now?: () => Date;
};

// req.ip honours Express `trust proxy` when configured; otherwise fall back to the socket address.
function clientIp(req: any): string {
    return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * A DB-backed fixed-window rate limiter, bound to a DataSource — the generic counterpart to
 * LoginThrottle for arbitrary endpoints.
 *
 * `RateLimit({bucket, limit, windowMs})` is a guard decorator: it counts this IP's hits in the
 * bucket over the window and answers 429 BEFORE the handler runs once the limit is reached — the
 * same thin-middleware shape as the auth guards, and it enriches OpenAPI with the 429 too. Counting
 * is append-and-count (one row per hit), so there is no counter row to upsert and race on. For a
 * sensitive, low-volume endpoint (register, password reset, login) that is exactly right; do not
 * decorate a hot path with it.
 *
 * `reset(bucket?)` clears counters (a dev who tripped their own limit); wire it to a small script.
 */
export function createRateLimit(db: DataSource, opts: RateLimitFactoryOptions = {}) {
    const entity = opts.hitEntity ?? (DefaultRateLimitOrm as EntityTarget<RateLimitHit>);
    const clock = opts.now ?? (() => new Date());

    /** Records one hit for (bucket, ip) and reports whether it is within the limit. */
    async function hit(bucket: string, ip: string, limit: number, windowMs: number): Promise<boolean> {
        const start = clock().getTime() - windowMs;
        const rows: RateLimitHit[] = await db.manager.findBy(entity, {bucket, ip} as any);
        const inWindow = rows.filter((r) => new Date(r.created_at).getTime() > start);
        if (inWindow.length >= limit) return false;
        await db.manager.insert(entity, {bucket, ip, created_at: clock()} as any);
        return true;
    }

    function RateLimit(o: RateLimitGuardOptions): MethodDecorator {
        const handler = async (req: any, _res: any, next: (err?: unknown) => void) => {
            try {
                const ok = await hit(o.bucket, clientIp(req), o.limit, o.windowMs);
                if (!ok) throw new RequestError(429, "Too many requests, please try again later", "TooManyRequests");
                next();
            } catch (e) {
                next(e);
            }
        };
        const mw = createMiddleware(handler).responses({code: 429, description: "Too Many Requests", type: ErrorResponseDto});
        return Middleware(mw);
    }

    /** Clear counters for one bucket, or all of them. Returns rows removed. */
    async function reset(bucket?: string): Promise<number> {
        if (bucket) {
            const r = await db.manager.delete(entity, {bucket} as any);
            return r.affected ?? 0;
        }
        const all: RateLimitHit[] = await db.manager.find(entity);
        for (const row of all) await db.manager.delete(entity, {id: row.id} as any);
        return all.length;
    }

    return {RateLimit, hit, reset};
}
