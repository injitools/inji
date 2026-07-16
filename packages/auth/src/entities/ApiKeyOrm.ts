import {Column, Entity, Index, PrimaryGeneratedColumn} from "typeorm";

/**
 * Ready-made API-key entity for Bearer authorization.
 * SECURITY RECOMMENDATION: store the key's SHA-256 in `hash`, not the key itself.
 * Then compute sha256(presentedKey) when looking it up — see createBearerAuth.
 */
@Entity('api_keys')
export default class ApiKeyOrm {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({type: 'bigint', unsigned: true})
    user_id: bigint;

    @Index()
    @Column({type: 'varchar', length: 255})
    hash: string;

    @Column({nullable: true})
    last_seen?: Date;
}
