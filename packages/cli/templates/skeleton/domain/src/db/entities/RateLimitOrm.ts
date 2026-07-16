import {Column, Entity, PrimaryColumn} from "typeorm";

// Fixed-window rate-limit counter, keyed by "<bucket>:<client-ip>" (e.g. "register:1.2.3.4").
// Persisted in the DB (not in memory) so the limit survives process restarts AND can be cleared
// out-of-band with `npm run ratelimit:reset` (see domain/src/rateLimitReset.ts).
@Entity("rate_limits")
export default class RateLimitOrm {
    @PrimaryColumn({length: 200})
    key: string;

    @Column({default: 0})
    count: number;

    // Start of the current window; once now - window_start ≥ windowMs the window resets to a fresh count.
    @Column({type: "timestamptz"})
    window_start: Date;
}
