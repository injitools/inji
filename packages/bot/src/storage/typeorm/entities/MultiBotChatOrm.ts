import {Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique} from "typeorm";
import type {Relation} from "typeorm";
import MultiBotChatMessageOrm from "./MultiBotChatMessageOrm.js";

/** A dialog between the bot and one peer on one provider. */
@Entity({name: 'multibot_chat'})
@Unique('unique_multibot_chat_user_peer', ['providerId', 'peer'])
export default class MultiBotChatOrm {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({nullable: true})
    providerId: string;

    @Column()
    provider: string;

    @Column()
    peer: string;

    @OneToMany(() => MultiBotChatMessageOrm, message => message.chat)
    messages: Relation<MultiBotChatMessageOrm>[];
}
