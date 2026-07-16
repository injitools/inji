import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity("users")
export default class UserOrm {
    @PrimaryGeneratedColumn({type: "bigint"})
    id: bigint;

    @Column({length: 64, unique: true})
    login: string;

    @Column({length: 120})
    name: string;

    // scrypt$<salt-hex>$<hash-hex> — see domain/auth/password.ts
    @Column({length: 255})
    password_hash: string;

    @Column({length: 16, default: "user"})
    role: string;

    @CreateDateColumn({type: "timestamptz"})
    created_at: Date;

    @Column({type: "timestamptz", nullable: true})
    last_seen: Date | null;
}
