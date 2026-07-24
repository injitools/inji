import {DataSource, EntityTarget} from "typeorm";

import DefaultLoginAttemptOrm from "./entities/LoginAttemptOrm.js";

/**
 * One recorded login attempt. Both successes and failures are stored: failures drive the throttle,
 * and the whole list is the "recent sign-ins & attempts on your account" the app can show a user.
 *
 * `user_id` is null when the attempt is not tied to a known account — an unknown login, or a spray
 * that never matched anyone. It is the application's own id type, exactly as with SessionService.
 */
export interface LoginAttemptRecord<TUserId = unknown> {
    id: number | bigint | string;
    user_id: TUserId | null;
    ip: string;
    success: boolean;
    user_agent?: string | null;
    created_at: Date;
}

/** What a caller reports for one attempt. */
export type LoginAttemptInput<TUserId = unknown> = {
    /** The account the attempt was against, when known. */
    userId?: TUserId | null;
    ip: string;
    success: boolean;
    userAgent?: string | null;
};

export type LoginThrottleOptions<TUserId = bigint> = {
    /** Attempt entity. Defaults to the built-in LoginAttemptOrm (user_id: bigint). */
    attemptEntity?: EntityTarget<LoginAttemptRecord<TUserId>>;
    /** Sliding window, ms. Default 1 hour. */
    windowMs?: number;
    /** Failures against one account within the window that block it. Default 5. */
    maxPerUser?: number;
    /** Failures from one IP within the window that block it (spray brute-force). Default 10. */
    maxPerIp?: number;
    /** Clock override — only for tests. */
    now?: () => Date;
};

/**
 * Login throttle on top of TypeORM.
 *
 * Every attempt is one appended row — not a per-key counter that gets rewritten (an upsert with a
 * unique key, which throws Duplicate-entry the moment a window expires and two paths race). Blocking
 * is a plain count of failures over the trailing window along TWO axes, exactly as an operator
 * reasons about it:
 *   • per `user_id` — someone is guessing ONE account's password;
 *   • per `ip`      — someone is spraying MANY accounts from one address (here user_id is irrelevant).
 * Either axis over its cap blocks; a block lifts on its own as failures age out — no lockout timer.
 * Only failures count; successes are recorded too, but purely so the user can see them.
 *
 * The built-in LoginAttemptOrm uses portable column types, so the SAME entity works on MySQL and
 * postgres — no per-dialect copy. Declare your own only to change the user_id TYPE (uuid instead of
 * bigint); that is a real difference, a column dialect is not.
 */
export default class LoginThrottle<TUserId = bigint> {
    readonly windowMs: number;
    readonly maxPerUser: number;
    readonly maxPerIp: number;
    private readonly db: DataSource;
    private readonly entity: EntityTarget<LoginAttemptRecord<TUserId>>;
    private readonly clock: () => Date;

    constructor(db: DataSource, opts: LoginThrottleOptions<TUserId> = {}) {
        this.db = db;
        this.entity = opts.attemptEntity ?? (DefaultLoginAttemptOrm as EntityTarget<LoginAttemptRecord<TUserId>>);
        this.windowMs = opts.windowMs ?? 60 * 60 * 1000;
        this.maxPerUser = opts.maxPerUser ?? 5;
        this.maxPerIp = opts.maxPerIp ?? 10;
        this.clock = opts.now ?? (() => new Date());
    }

    /** Record one attempt (success or failure). */
    async record(attempt: LoginAttemptInput<TUserId>): Promise<void> {
        await this.db.manager.insert(this.entity, {
            user_id: attempt.userId ?? null,
            ip: attempt.ip,
            success: attempt.success,
            user_agent: attempt.userAgent ?? null,
            created_at: this.clock(),
        } as any);
    }

    /**
     * Seconds until the caller is allowed again (0 = allowed). Blocks while EITHER the account or the
     * IP has too many failures in the window; the wait is until that axis's cap-th newest failure
     * ages out.
     */
    async retryAfter(subject: {userId?: TUserId | null; ip: string}): Promise<number> {
        const now = this.clock().getTime();
        let secs = this.waitFor(await this.failures({ip: subject.ip}, now), this.maxPerIp, now);
        if (subject.userId != null) {
            const perUser = this.waitFor(await this.failures({user_id: subject.userId}, now), this.maxPerUser, now);
            secs = Math.max(secs, perUser);
        }
        return secs;
    }

    /**
     * Recent attempts against an account, newest first — the data behind a "who tried to sign in"
     * panel. Both successes and failures, so a user sees their own logins next to any intrusions.
     */
    async history(userId: TUserId, limit = 20): Promise<LoginAttemptRecord<TUserId>[]> {
        const rows: LoginAttemptRecord<TUserId>[] = await this.db.manager.findBy(this.entity, {user_id: userId} as any);
        return rows
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, limit);
    }

    /** Accounts currently blocked (failures ≥ maxPerUser in the window) → the moment each unblocks. */
    async blockedUsers(): Promise<Map<string, Date>> {
        const now = this.clock().getTime();
        const start = now - this.windowMs;
        const all: LoginAttemptRecord[] = await this.db.manager.find(this.entity);
        const byUser = new Map<string, Date[]>();
        for (const row of all) {
            if (row.user_id == null || row.success) continue;
            const at = new Date(row.created_at);
            if (at.getTime() <= start) continue;
            const key = String(row.user_id);
            const bucket = byUser.get(key);
            if (bucket) bucket.push(at);
            else byUser.set(key, [at]);
        }
        const blocked = new Map<string, Date>();
        for (const [key, fails] of byUser) {
            fails.sort((a, b) => b.getTime() - a.getTime());
            if (fails.length >= this.maxPerUser) blocked.set(key, new Date(fails[this.maxPerUser - 1].getTime() + this.windowMs));
        }
        return blocked;
    }

    /** Forget one account's attempts (an admin unlock). Returns rows removed. */
    async clearUser(userId: TUserId): Promise<number> {
        const r = await this.db.manager.delete(this.entity, {user_id: userId} as any);
        return r.affected ?? 0;
    }

    /** Forget every attempt. Returns rows removed. */
    async clearAll(): Promise<number> {
        const all: LoginAttemptRecord[] = await this.db.manager.find(this.entity);
        for (const row of all) await this.db.manager.delete(this.entity, {id: row.id} as any);
        return all.length;
    }

    /** Failed attempts of a subject still inside the window, newest first. */
    private async failures(where: Record<string, unknown>, now: number): Promise<Date[]> {
        const start = now - this.windowMs;
        const rows: LoginAttemptRecord[] = await this.db.manager.findBy(this.entity, {...where, success: false} as any);
        return rows
            .map((r) => new Date(r.created_at))
            .filter((d) => d.getTime() > start)
            .sort((a, b) => b.getTime() - a.getTime());
    }

    /** Seconds until failures drop below `max` (0 if already below). */
    private waitFor(failuresDesc: Date[], max: number, now: number): number {
        if (failuresDesc.length < max) return 0;
        const until = failuresDesc[max - 1].getTime() + this.windowMs;
        return Math.max(1, Math.ceil((until - now) / 1000));
    }
}
