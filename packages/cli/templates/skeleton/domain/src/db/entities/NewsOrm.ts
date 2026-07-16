import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity("news")
export default class NewsOrm {
    @PrimaryGeneratedColumn({type: "bigint"})
    id: bigint;

    @Column({type: "varchar", length: 200})
    title: string;

    @Column({type: "text"})
    body: string;

    @Column({type: "boolean", default: true})
    published: boolean;

    // Scheduled publication: a draft (published=false) with publish_at ≤ now()
    // is switched to published=true by the publisher worker on a cron. null — no schedule.
    @Column({type: "timestamptz", nullable: true})
    publish_at: Date | null;

    @Column({type: "varchar", length: 120, nullable: true})
    author: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
