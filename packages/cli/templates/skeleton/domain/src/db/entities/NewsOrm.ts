import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity("news")
export default class NewsOrm {
    @PrimaryGeneratedColumn({type: "bigint"})
    id: bigint;

    @Column({length: 200})
    title: string;

    // Explicit: an inferred `string` would become varchar, not text.
    @Column({type: "text"})
    body: string;

    @Column({default: true})
    published: boolean;

    // Scheduled publication: a draft (published=false) with publish_at ≤ now()
    // is switched to published=true by the publisher worker on a cron. null — no schedule.
    @Column({type: "timestamptz", nullable: true})
    publish_at: Date | null;

    @Column({length: 120, nullable: true})
    author: string | null;

    @CreateDateColumn({type: "timestamptz"})
    created_at: Date;

    @UpdateDateColumn({type: "timestamptz"})
    updated_at: Date;
}
