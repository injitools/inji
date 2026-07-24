import {Column, Entity, Index, PrimaryGeneratedColumn} from "typeorm";

import type {LoginAttemptRecord} from "../LoginThrottle.js";

/**
 * Ready-made login-attempt log for LoginThrottle.
 *
 * One row per attempt (success or failure). Failures drive the throttle; the whole list is the
 * "recent sign-ins & attempts on your account" a UI can show the user.
 *
 * The column types are deliberately PORTABLE — no `timestamptz`, no `bigint unsigned`, no `jsonb` —
 * so the SAME entity works on MySQL and postgres. That is the general rule for these built-ins: a
 * dialect-specific type is what forces an app to redeclare an entity, and none is needed here.
 * Declare your own only to change the user_id TYPE (uuid instead of bigint), which is a real
 * semantic difference, not a dialect one.
 */
@Entity("login_attempts")
@Index(["ip", "created_at"])
@Index(["user_id", "created_at"])
export default class LoginAttemptOrm implements LoginAttemptRecord<bigint> {
    @PrimaryGeneratedColumn("increment", {type: "bigint"})
    id: bigint;

    /** The account the attempt was against, when known. Null for an unknown login or a spray. */
    @Column({type: "bigint", nullable: true})
    user_id: bigint | null;

    /** Client IP. 45 chars fits an IPv6 literal. */
    @Column({length: 45})
    ip: string;

    /** Did it succeed. Only failures count toward a block; successes are kept for the user's history. */
    @Column({default: false})
    success: boolean;

    /** User-agent of the attempt — shown next to a sign-in in the account's history. */
    @Column({type: "text", nullable: true})
    user_agent?: string | null;

    /**
     * When it happened. Set by LoginThrottle, not `@CreateDateColumn`: the service owns the clock
     * (a test can inject one), and the type is inferred from `Date` so it stays portable across
     * dialects (datetime on MySQL, timestamp on postgres).
     */
    @Column()
    created_at: Date;
}
