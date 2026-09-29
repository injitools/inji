import {Column, Entity, JoinColumn, ManyToOne, PrimaryColumn} from "typeorm";
import type {Relation} from "typeorm";
import MultiBotChatOrm from "./MultiBotChatOrm.js";

/**
 * Per-chat key/value state (awaited input, anything the app sets via `chat.setOption`).
 * `type` is `typeof value` at write time and drives the decoding on read.
 */
@Entity({name: 'multibot_chat_option'})
export default class MultiBotChatOptionOrm {
    @PrimaryColumn()
    chatId: number;

    @PrimaryColumn()
    param: string;

    @Column()
    type: string;

    @Column()
    value: string;

    @ManyToOne(() => MultiBotChatOrm, {onUpdate: "CASCADE", onDelete: "CASCADE"})
    @JoinColumn({name: 'chatId'})
    chat: Relation<MultiBotChatOrm>;
}
