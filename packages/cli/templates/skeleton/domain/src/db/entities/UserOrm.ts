import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity("users")
export default class UserOrm {
    @PrimaryGeneratedColumn({type: "bigint"})
    id: bigint;

    @Column({type: "varchar", length: 64, unique: true})
    login: string;

    @Column({type: "varchar", length: 120})
    name: string;

    // scrypt$<salt-hex>$<hash-hex> — see domain/auth/password.ts
    @Column({type: "varchar", length: 255})
    password_hash: string;

    @Column({type: "varchar", length: 16, default: "user"})
    role: string;

    @CreateDateColumn()
    created_at: Date;

    @Column({type: "timestamptz", nullable: true})
    last_seen: Date | null;
}
