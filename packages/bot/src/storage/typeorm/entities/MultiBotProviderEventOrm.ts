import {Column, Entity, PrimaryColumn} from "typeorm";

/** Raw provider updates, verbatim; (provider, eventId) dedups re-deliveries. See MultiBotProviderEvent. */
@Entity({name: 'multibot_provider_event'})
export default class MultiBotProviderEventOrm<T = any> {
    @PrimaryColumn()
    provider: string;

    @PrimaryColumn()
    eventId: string;

    @Column()
    type: string;

    @Column()
    date: Date;

    @Column({type: "json", nullable: true, default: null})
    data: T;

    @Column()
    executed: boolean;

    @Column({type: 'text', nullable: true})
    error: string;
}
