import {DataSource, EntityTarget, IsNull} from "typeorm";

import SessionService, {CreateSessionOptions} from "./SessionService.js";
import LoginTokenOrm from "./entities/LoginTokenOrm.js";
import {AuthError} from "./errors/AuthError.js";
import {generateToken, sha256} from "./tokens.js";

/**
 * Structural shape of the login-token entity. The identity type is parameterized
 * by TUserId (same as SessionService).
 */
export interface LoginTokenRecord<TUserId = unknown> {
    id: number;
    token_hash: string;
    user_id: TUserId;
    expires_at: Date;
    consumed_at?: Date | null;
}

export type MagicLinkOptions<TUserId = bigint> = {
    /** Token entity. Defaults to the built-in LoginTokenOrm (user_id: bigint). */
    tokenEntity?: EntityTarget<LoginTokenRecord<TUserId>>
    /** TTL of the one-time token. Defaults to 15 minutes. */
    defaultTtlMs?: number
    /** Length of the random secret in bytes. Defaults to 48. */
    tokenBytes?: number
}

export type VerifyLoginResult<TUserId> = {
    userId: TUserId
    /** Raw sid of the created session. */
    sid: string
    /** Ready-to-use Set-Cookie header. */
    cookie: string
}

/**
 * First-class magic-link / one-time-token primitive.
 * Flow: `requestLogin` (issue a secret, store only its sha256 hash in the DB, TTL) → the user presents
 * the raw token → `verifyLogin` (validate + single-use consume + create a session via SessionService).
 *
 * Relies on the identity model and the hashing approach: the raw token is never
 * stored in the DB, and reuse is rejected atomically (guarded update on consumed_at IS NULL).
 */
export default class MagicLinkService<TUserId = bigint> {
    private readonly db: DataSource
    private readonly sessions: SessionService<TUserId>
    private readonly entity: EntityTarget<LoginTokenRecord<TUserId>>
    readonly defaultTtlMs: number
    private readonly tokenBytes: number

    constructor(db: DataSource, sessions: SessionService<TUserId>, opts: MagicLinkOptions<TUserId> = {}) {
        this.db = db
        this.sessions = sessions
        this.entity = opts.tokenEntity ?? (LoginTokenOrm as EntityTarget<LoginTokenRecord<TUserId>>)
        this.defaultTtlMs = opts.defaultTtlMs ?? 1000 * 60 * 15 // 15 minutes
        this.tokenBytes = opts.tokenBytes ?? 48
    }

    /**
     * Issues a one-time token for the user. Returns the RAW token (for the email/link)
     * and its expiry. Only sha256(token) is stored in the DB.
     */
    async requestLogin(userId: TUserId, opts: {ttlMs?: number} = {}): Promise<{token: string; expiresAt: Date}> {
        const token = generateToken(this.tokenBytes)
        const ttlMs = opts.ttlMs ?? this.defaultTtlMs
        const expiresAt = new Date(Date.now() + ttlMs)

        await this.db.manager.insert(this.entity, {
            token_hash: sha256(token),
            user_id: userId,
            expires_at: expiresAt,
            consumed_at: null,
        } as any)

        return {token, expiresAt}
    }

    /**
     * Verifies a raw token: existence, expiry, not-yet-consumed; atomically consumes it (single-use)
     * and creates a session via SessionService. Any failure → AuthError (no leaking of the cause
     * beyond the message). Calling again with the same token → AuthError.
     */
    async verifyLogin(rawToken: string, sessionOpts: CreateSessionOptions = {}): Promise<VerifyLoginResult<TUserId>> {
        const hash = sha256(rawToken)
        const rec = await this.db.manager.findOneBy(this.entity, {token_hash: hash} as any)
        if (!rec) throw new AuthError("Invalid login token")
        if (rec.consumed_at) throw new AuthError("Login token already used")
        if (rec.expires_at <= new Date()) throw new AuthError("Login token expired")

        // Single-use: consume ONLY if not yet consumed (consumed_at IS NULL). On a race, the loser
        // gets affected=0 — reject it so that a single token can't create two sessions.
        const res = await this.db.manager.update(
            this.entity,
            {id: rec.id, consumed_at: IsNull()} as any,
            {consumed_at: new Date()} as any,
        )
        if (!res.affected) throw new AuthError("Login token already used")

        const {sid, cookie} = await this.sessions.createSession(rec.user_id, null, sessionOpts)
        return {userId: rec.user_id, sid, cookie}
    }
}
