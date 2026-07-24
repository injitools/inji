import {Column, Entity, Index, PrimaryGeneratedColumn} from "typeorm";

import type {RateLimitHit} from "../rateLimit.js";

/**
 * Ready-made hit log for the generic `@RateLimit` guard.
 *
 * One row per request (append-only), counted per (bucket, ip) over the window — the same shape as
 * LoginThrottle, and for the same reason: a per-key counter row needs an upsert, and the upsert is
 * what slips extra requests through or throws under a race. Portable column types, so one entity
 * serves MySQL and postgres.
 */
@Entity("rate_limit_hits")
@Index(["bucket", "ip", "created_at"])
export default class RateLimitOrm implements RateLimitHit {
    @PrimaryGeneratedColumn("increment", {type: "bigint"})
    id: bigint;

    /** Endpoint bucket — different buckets count independently (e.g. "register", "password-reset"). */
    @Column({length: 64})
    bucket: string;

    /** Client IP. 45 chars fits an IPv6 literal. */
    @Column({length: 45})
    ip: string;

    /** Set by the limiter (not `@CreateDateColumn`) — the service owns the clock; type inferred, portable. */
    @Column()
    created_at: Date;
}
