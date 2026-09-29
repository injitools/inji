import {Column, Entity, PrimaryColumn} from "typeorm";

/** Per-provider key/value state: poll offsets, long-poll servers. */
@Entity({name: 'multibot_provider_options'})
export default class MultiBotProviderOptionsOrm {
    @PrimaryColumn()
    provider: string;

    @PrimaryColumn()
    param: string;

    @Column({type: "json"})
    value: any;
}
