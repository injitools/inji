import {Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn} from "typeorm";

import type {LoginTokenRecord} from "../MagicLinkService.js";

/**
 * Ready-made one-time login-token entity (magic-link).
 * The token_hash column stores ONLY sha256(token) — the raw token goes to the user
 * (in an email/link) and is never persisted in the DB. consumed_at enforces single-use: after a
 * successful verification, reuse is rejected.
 *
 * For UUID identity, declare an analog with `user_id: string` (`@Column('uuid')`) —
 * it satisfies LoginTokenRecord<string> and plugs in via the service's type parameter.
 */
@Entity('login_tokens')
export default class LoginTokenOrm implements LoginTokenRecord<bigint> {
    @PrimaryGeneratedColumn()
    id: number;

    @Index({unique: true})
    @Column({type: 'varchar', length: 128})
    token_hash: string;

    @Index()
    @Column({type: 'bigint', unsigned: true})
    user_id: bigint;

    @Column()
    expires_at: Date;

    @Column({type: 'timestamptz', nullable: true})
    consumed_at?: Date | null;

    @CreateDateColumn()
    created_at: Date;
}
