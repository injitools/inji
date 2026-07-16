import {DataSource, EntityTarget} from "typeorm";

import UserSessionOrm from "./entities/UserSessionOrm.js";
import {generateToken, sha256} from "./tokens.js";

export type CookieSameSite = 'Lax' | 'Strict' | 'None'

/**
 * Minimal structural shape of the session entity. Any custom entity that
 * satisfies it plugs into SessionService without `as any`. The user-key type is
 * parameterized by TUserId (bigint by default; string/uuid for checkin-adventure).
 */
export interface SessionRecord<TUserId = unknown> {
    sid: string;
    user_id: TUserId;
    data?: Record<string, any> | null;
    last_seen: Date;
    expires_at: Date;
}

export type SessionServiceOptions<TUserId = bigint> = {
    /** Session entity. Defaults to the built-in UserSessionOrm (user_id: bigint). */
    sessionEntity?: EntityTarget<SessionRecord<TUserId>>
    defaultTtlMs?: number
    cookieName?: string
    /**
     * Store sha256(sid) in the DB instead of the raw value (RECOMMENDED).
     * The raw sid is sent to the client in the cookie; the sid column holds only the hash. Defaults to
     * false — compatible with already-existing raw sids. Mirrors the hashKey option of createBearerAuth.
     */
    hashTokens?: boolean
    /** Callback on a successful getSession (e.g. to update the user's last_seen). */
    onTouch?: (session: SessionRecord<TUserId>) => Promise<void> | void
}

export type CreateSessionOptions = {
    ttlMs?: number,
    cookieName?: string,
    cookieDomain?: string,
    sameSite?: CookieSameSite,
    secure?: boolean,
    httpOnly?: boolean,
    path?: string,
}

/**
 * Cookie-session service on top of TypeORM. Bound to a specific DataSource via the
 * constructor. Parameterized by the user identity type and can optionally
 * store the sid by hash.
 *
 * The default `new SessionService(db)` ≡ `SessionService<bigint>` with the built-in UserSessionOrm —
 * backward compatibility is preserved. For UUID identity:
 *   `new SessionService<string>(db, {sessionEntity: MyUuidSessionOrm})`.
 */
export default class SessionService<TUserId = bigint> {
    readonly defaultTtlMs: number
    readonly defaultCookieName: string
    private readonly db: DataSource
    private readonly entity: EntityTarget<SessionRecord<TUserId>>
    private readonly hashTokens: boolean
    private readonly onTouch?: SessionServiceOptions<TUserId>['onTouch']

    constructor(db: DataSource, opts: SessionServiceOptions<TUserId> = {}) {
        this.db = db
        this.entity = opts.sessionEntity ?? (UserSessionOrm as EntityTarget<SessionRecord<TUserId>>)
        this.defaultTtlMs = opts.defaultTtlMs ?? 1000 * 60 * 60 * 24 * 30 // 30 days
        this.defaultCookieName = opts.cookieName ?? 'sid'
        this.hashTokens = opts.hashTokens ?? false
        this.onTouch = opts.onTouch
    }

    /** The value we look up / store in the sid column: the hash or the raw sid. */
    private storedSid(rawSid: string): string {
        return this.hashTokens ? sha256(rawSid) : rawSid
    }

    /** Generates a random sid, writes to the DB (hashed when hashTokens), returns the RAW sid and Set-Cookie. */
    async createSession(userId: TUserId, data?: Record<string, any> | null, opts: CreateSessionOptions = {}) {
        const ttlMs = opts.ttlMs ?? this.defaultTtlMs;
        const sameSite = opts.sameSite ?? 'Lax';
        const cookieName = opts.cookieName ?? this.defaultCookieName;
        const path = opts.path ?? '/';
        const httpOnly = opts.httpOnly ?? true;
        const secure = opts.secure ?? true;

        const sid = generateToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);

        await this.db.manager.insert(this.entity, {
            sid: this.storedSid(sid),
            user_id: userId,
            data: data ?? null,
            expires_at: expiresAt,
            last_seen: now,
        } as any)

        const cookie = SessionService.buildCookieHeader(cookieName, sid, {
            expires: expiresAt,
            path,
            httpOnly,
            secure,
            sameSite,
            domain: opts.cookieDomain,
        })

        // The client gets the raw sid (in the cookie and the return value); the DB holds storedSid(sid).
        return {sid, cookie}
    }

    /** SELECT by (hashed) sid + expires_at check. Deletes expired ones. Updates last_seen. */
    async getSession(rawSid: string): Promise<SessionRecord<TUserId> | null> {
        const stored = this.storedSid(rawSid)
        const sess = await this.db.manager.findOneBy(this.entity, {sid: stored} as any)
        if (!sess) return null
        const now = new Date()
        if (sess.expires_at <= now) {
            await this.db.manager.delete(this.entity, {sid: stored} as any)
            return null
        }
        await this.db.manager.update(this.entity, {sid: stored} as any, {last_seen: now} as any)
        if (this.onTouch) await this.onTouch(sess)
        return sess
    }

    async destroySession(rawSid: string) {
        await this.db.manager.delete(this.entity, {sid: this.storedSid(rawSid)} as any)
    }

    static buildCookieHeader(name: string, value: string, options: {
        expires: Date,
        path: string,
        httpOnly: boolean,
        secure: boolean,
        sameSite: CookieSameSite,
        domain?: string,
    }) {
        const parts = [
            `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
            `Path=${options.path}`,
            `Expires=${options.expires.toUTCString()}`,
            `SameSite=${options.sameSite}`,
        ]
        if (options.httpOnly) parts.push('HttpOnly')
        if (options.secure) parts.push('Secure')
        if (options.domain) parts.push(`Domain=${options.domain}`)
        return parts.join('; ')
    }
}
