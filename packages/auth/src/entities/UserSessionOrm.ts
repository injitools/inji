import {Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn} from "typeorm";

import type {SessionRecord} from "../SessionService.js";

/**
 * Ready-made session entity (user_id: bigint — the default identity). Add it to the
 * entities of your DataSource. Stores the sid (raw or sha256 — see SessionService.hashTokens),
 * the owner, arbitrary data, and the lifetime.
 *
 * For UUID identity, declare a similar entity with `user_id: string`
 * (`@Column('uuid')`) — it satisfies SessionRecord<string> and plugs in via
 * `new SessionService<string>(db, {sessionEntity: ...})` without any type casts.
 */
@Entity('user_sessions')
export default class UserSessionOrm implements SessionRecord<bigint> {
    @PrimaryColumn({type: 'varchar', length: 128})
    sid: string;

    @Index()
    @Column({type: 'bigint', unsigned: true})
    user_id: bigint;

    @Column({type: 'jsonb', nullable: true})
    data?: Record<string, any> | null;

    @Column({nullable: true})
    last_seen: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Index()
    @Column()
    expires_at: Date;
}
