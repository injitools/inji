import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import type {Relation} from "typeorm";
import MultiBotChatOrm from "./MultiBotChatOrm.js";
import {MultiBotMessageType} from "../../../MultiBotMessageType.js";

/** Every message in both directions. */
@Entity({name: 'multibot_chat_message'})
export default class MultiBotChatMessageOrm<T = any> {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    chatId: number;

    @Column()
    from: string;

    @Column()
    to: string;

    @Column({nullable: true})
    providerId: string;

    @Column({type: "enum", enum: MultiBotMessageType})
    type: MultiBotMessageType;

    @Column({type: 'text', nullable: true})
    text: string;

    /** Reserved for a serialized MultiBotMessageTemplate; not written yet. */
    @Column({type: 'text', nullable: true})
    template: string;

    @Column({nullable: true})
    date: Date;

    @Column({type: "json", nullable: true, default: null})
    meta: T;

    @Column({type: "json", nullable: true, default: null})
    context: T;

    @ManyToOne(() => MultiBotChatOrm, chat => chat.messages, {onUpdate: "CASCADE", onDelete: "CASCADE"})
    @JoinColumn({name: 'chatId'})
    chat: Relation<MultiBotChatOrm>;
}
