import type {EntityManager} from "typeorm";

import type IMultiBotStorageProvider from "../../interfaces/IMultiBotStorageProvider.js";
import MultiBotMessage from "../../MultiBotMessage.js";
import MultiBotProviderEvent from "../../MultiBotProviderEvent.js";
import MultiBotChat from "../../MultiBotChat.js";
import MultiBotProviderOptionsOrm from "./entities/MultiBotProviderOptionsOrm.js";
import MultiBotChatOrm from "./entities/MultiBotChatOrm.js";
import MultiBotProviderEventOrm from "./entities/MultiBotProviderEventOrm.js";
import MultiBotChatMessageOrm from "./entities/MultiBotChatMessageOrm.js";
import MultiBotChatOptionOrm from "./entities/MultiBotChatOptionOrm.js";
import {multiBotEntities} from "./entities/index.js";

/**
 * IMultiBotStorageProvider on TypeORM. Takes an EntityManager (`dataSource.manager`, or a
 * transaction's) — the entities in `MultiBotTypeOrmProvider.entities` must be registered in the
 * DataSource.
 */
export default class MultiBotTypeOrmProvider implements IMultiBotStorageProvider {
    static entities = multiBotEntities;

    constructor(private manager: EntityManager) {
    }

    // ── Provider options ─────────────────────────────────────────────────────────

    async updateProviderOption(provider: string, param: string, value: any) {
        // json column: TypeORM serializes the value itself.
        await this.manager.upsert(MultiBotProviderOptionsOrm, {provider, param, value}, ['provider', 'param']);
    }

    async getProviderOption<T = any>(provider: string, param: string): Promise<T | undefined> {
        const orm = await this.manager.findOneBy(MultiBotProviderOptionsOrm, {provider, param});
        return orm ? (orm.value as T) : undefined;
    }

    // ── Messages ─────────────────────────────────────────────────────────────────

    async saveMessage<T = any>(message: MultiBotMessage<T>) {
        let msgOrm = new MultiBotChatMessageOrm();
        if (message.id) {
            msgOrm = await this.manager.findOneBy(MultiBotChatMessageOrm, {id: message.id}) || msgOrm;
        } else if (message.providerId) {
            msgOrm = await this.manager.findOneBy(MultiBotChatMessageOrm, {
                chatId: message.chat.id,
                providerId: message.providerId,
            }) || msgOrm;
        }

        msgOrm.chatId = message.chat.id;
        msgOrm.from = message.from;
        msgOrm.to = message.to;
        msgOrm.providerId = message.providerId;
        msgOrm.type = message.type;
        msgOrm.text = message.text;
        msgOrm.date = message.date;
        msgOrm.meta = message.meta;
        msgOrm.context = message.context;
        msgOrm = await this.manager.save(msgOrm);
        message.id = msgOrm.id;
    }

    // ── Provider events ──────────────────────────────────────────────────────────

    async saveProviderEvent<T = any>(providerEvent: MultiBotProviderEvent<T>) {
        await this.manager.upsert(MultiBotProviderEventOrm, {
            provider: providerEvent.provider,
            eventId: providerEvent.eventId,
            type: providerEvent.type,
            date: providerEvent.date,
            data: providerEvent.data,
            executed: providerEvent.executed,
            error: providerEvent.error,
        }, ['provider', 'eventId']);
    }

    async getProviderEvent(provider: string, eventId: string): Promise<MultiBotProviderEvent | undefined> {
        const eventOrm = await this.manager.findOneBy(MultiBotProviderEventOrm, {provider, eventId});
        if (!eventOrm) {
            return undefined;
        }
        const providerEvent = new MultiBotProviderEvent();
        providerEvent.provider = eventOrm.provider;
        providerEvent.eventId = eventOrm.eventId;
        providerEvent.date = eventOrm.date;
        providerEvent.type = eventOrm.type;
        providerEvent.data = eventOrm.data;
        providerEvent.executed = eventOrm.executed;
        providerEvent.error = eventOrm.error;
        return providerEvent;
    }

    // ── Chat options ─────────────────────────────────────────────────────────────

    async updateChatOption(chatId: number, param: string, value: any) {
        const type = typeof value;
        // The column is a string: objects as JSON, everything else via String() — so a boolean is
        // stored as 'true'/'false' explicitly rather than by whatever the driver makes of it.
        const stored = type === 'object' ? JSON.stringify(value) : String(value);
        await this.manager.upsert(MultiBotChatOptionOrm, {chatId, param, type, value: stored}, ['chatId', 'param']);
    }

    async getChatOption<T = any>(chatId: number, param: string): Promise<T | undefined> {
        const orm = await this.manager.findOneBy(MultiBotChatOptionOrm, {chatId, param});
        if (!orm) {
            return undefined;
        }
        switch (orm.type) {
            case 'number':
                return +orm.value as T;
            case 'object':
                return JSON.parse(orm.value) as T;
            case 'boolean':
                // 'true'/'false' from this provider; '1'/'0' from rows written by older code.
                return (orm.value === 'true' || orm.value === '1') as T;
            default:
                return orm.value as T;
        }
    }

    // ── Chats ────────────────────────────────────────────────────────────────────

    private toChat(chatOrm: MultiBotChatOrm) {
        const chat = new MultiBotChat();
        chat.id = chatOrm.id;
        chat.providerId = chatOrm.providerId;
        chat.providerName = chatOrm.provider;
        chat.peer = chatOrm.peer;
        return chat;
    }

    async getChatByPeers(provider: string, peer: string): Promise<MultiBotChat> {
        let chatOrm = await this.manager.findOneBy(MultiBotChatOrm, {provider, peer});
        if (!chatOrm) {
            chatOrm = new MultiBotChatOrm();
            chatOrm.provider = provider;
            chatOrm.peer = peer;
            chatOrm = await this.manager.save(chatOrm);
        }
        return this.toChat(chatOrm);
    }

    async getChatById(id: number): Promise<MultiBotChat | undefined> {
        const chatOrm = await this.manager.findOneBy(MultiBotChatOrm, {id});
        return chatOrm ? this.toChat(chatOrm) : undefined;
    }

    async getChatByProviderId(provider: string, providerId: string): Promise<MultiBotChat | undefined> {
        const chatOrm = await this.manager.findOneBy(MultiBotChatOrm, {provider, providerId});
        return chatOrm ? this.toChat(chatOrm) : undefined;
    }

    async saveChat(chat: MultiBotChat) {
        let chatOrm = (chat.id && await this.manager.findOneBy(MultiBotChatOrm, {id: chat.id})) || new MultiBotChatOrm();
        chatOrm.providerId = chat.providerId;
        chatOrm.provider = chat.providerName;
        chatOrm.peer = chat.peer;
        chatOrm = await this.manager.save(chatOrm);
        chat.id = chatOrm.id;
        return chat;
    }
}
