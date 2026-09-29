import type IMultiBotStorageProvider from "../interfaces/IMultiBotStorageProvider.js";
import MultiBotChat from "../MultiBotChat.js";
import type MultiBotMessage from "../MultiBotMessage.js";
import MultiBotProviderEvent from "../MultiBotProviderEvent.js";

/**
 * In-memory IMultiBotStorageProvider — the reference implementation, for tests and prototypes.
 * Nothing survives the process; use `@injitools/bot/typeorm` (or your own) for a real bot.
 */
export default class MultiBotMemoryStorage implements IMultiBotStorageProvider {
    readonly providerOptions = new Map<string, any>();
    readonly chats: MultiBotChat[] = [];
    readonly chatOptions = new Map<string, any>();
    readonly messages: MultiBotMessage[] = [];
    readonly events = new Map<string, MultiBotProviderEvent>();
    private nextChatId = 1;
    private nextMessageId = 1;

    async getProviderOption<T = any>(provider: string, param: string): Promise<T | undefined> {
        return this.providerOptions.get(`${provider}\0${param}`);
    }

    async updateProviderOption(provider: string, param: string, value: any) {
        this.providerOptions.set(`${provider}\0${param}`, value);
    }

    private clone(chat: MultiBotChat) {
        const c = new MultiBotChat();
        c.id = chat.id;
        c.providerId = chat.providerId;
        c.providerName = chat.providerName;
        c.peer = chat.peer;
        return c;
    }

    async getChatByPeers(provider: string, peer: string) {
        let chat = this.chats.find(c => c.providerName === provider && c.peer === peer);
        if (!chat) {
            chat = new MultiBotChat();
            chat.providerName = provider;
            chat.peer = peer;
            chat.providerId = null;
            await this.saveChat(chat);
        }
        return this.clone(chat);
    }

    async getChatByProviderId(provider: string, providerId: string) {
        const chat = this.chats.find(c => c.providerName === provider && c.providerId === providerId);
        return chat && this.clone(chat);
    }

    async getChatById(chatId: number) {
        const chat = this.chats.find(c => c.id === chatId);
        return chat && this.clone(chat);
    }

    async saveChat(chat: MultiBotChat) {
        const existing = chat.id && this.chats.find(c => c.id === chat.id);
        if (existing) {
            Object.assign(existing, {providerId: chat.providerId, providerName: chat.providerName, peer: chat.peer});
        } else {
            chat.id = this.nextChatId++;
            this.chats.push(this.clone(chat));
        }
        return chat;
    }

    async saveMessage<T = any>(message: MultiBotMessage<T>) {
        if (!message.id) {
            const existing = message.providerId && this.messages.find(m => m.chat?.id === message.chat.id && m.providerId === message.providerId);
            message.id = existing ? existing.id : this.nextMessageId++;
        }
        const idx = this.messages.findIndex(m => m.id === message.id);
        if (idx >= 0) {
            this.messages[idx] = message;
        } else {
            this.messages.push(message);
        }
    }

    async saveProviderEvent<T = any>(providerEvent: MultiBotProviderEvent<T>) {
        const copy = new MultiBotProviderEvent();
        Object.assign(copy, providerEvent);
        this.events.set(`${providerEvent.provider}\0${providerEvent.eventId}`, copy);
    }

    async getProviderEvent(provider: string, eventId: string) {
        const event = this.events.get(`${provider}\0${eventId}`);
        if (!event) {
            return undefined;
        }
        const copy = new MultiBotProviderEvent();
        Object.assign(copy, event);
        return copy;
    }

    async updateChatOption(chatId: number, option: string, value: any) {
        this.chatOptions.set(`${chatId}\0${option}`, value);
    }

    async getChatOption<T = any>(chatId: number, option: string): Promise<T | undefined> {
        return this.chatOptions.get(`${chatId}\0${option}`);
    }
}
