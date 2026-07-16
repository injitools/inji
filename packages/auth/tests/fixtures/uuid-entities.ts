// Fixtures for custom UUID identity (issue #6): entities with user_id: string.
// They satisfy the structural contracts SessionRecord<string>/LoginTokenRecord<string>,
// so they plug into SessionService<string>/MagicLinkService<string> without `as any`.
import {Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn} from "typeorm";
import type {SessionRecord, LoginTokenRecord} from "@injitools/auth";

@Entity("uuid_user_sessions")
export class UuidUserSessionOrm implements SessionRecord<string> {
    @PrimaryColumn({type: "varchar", length: 128})
    sid: string;

    @Index()
    @Column({type: "uuid"})
    user_id: string;

    @Column({type: "jsonb", nullable: true})
    data?: Record<string, any> | null;

    @Column({nullable: true})
    last_seen: Date;

    @Column()
    expires_at: Date;

    @CreateDateColumn()
    created_at: Date;
}

@Entity("uuid_login_tokens")
export class UuidLoginTokenOrm implements LoginTokenRecord<string> {
    @PrimaryGeneratedColumn()
    id: number;

    @Index({unique: true})
    @Column({type: "varchar", length: 128})
    token_hash: string;

    @Index()
    @Column({type: "uuid"})
    user_id: string;

    @Column()
    expires_at: Date;

    @Column({type: "timestamptz", nullable: true})
    consumed_at?: Date | null;

    @CreateDateColumn()
    created_at: Date;
}
