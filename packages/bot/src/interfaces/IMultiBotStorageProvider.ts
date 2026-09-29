import type MultiBotMessage from "../MultiBotMessage.js";
import type MultiBotProviderEvent from "../MultiBotProviderEvent.js";
import type MultiBotChat from "../MultiBotChat.js";

/**
 * Persistence behind MultiBot: chats, messages, per-chat options (dialog state), per-provider
 * options (poll offsets) and the raw provider events (dedup + audit). `@injitools/bot/typeorm`
 * implements it on TypeORM; anything else (Redis, a KV store) fits this interface.
 *
 * Chats returned here are bare records — MultiBot attaches `bot` and `provider` itself.
 */
export default interface IMultiBotStorageProvider {
    getProviderOption<T = any>(provider: string, param: string): Promise<T | undefined>;

    updateProviderOption(provider: string, param: string, value: any): Promise<void>;

    /** Find or CREATE the chat for a peer. */
    getChatByPeers(provider: string, peer: string): Promise<MultiBotChat>;

    getChatByProviderId(provider: string, providerId: string): Promise<MultiBotChat | undefined>;

    getChatById(chatId: number): Promise<MultiBotChat | undefined>;

    saveChat(chat: MultiBotChat): Promise<MultiBotChat>;

    /** Insert or update (by `id`, else by chat + `providerId`); sets `message.id`. */
    saveMessage<T = any>(message: MultiBotMessage<T>): Promise<void>;

    saveProviderEvent<T = any>(providerEvent: MultiBotProviderEvent<T>): Promise<void>;

    getProviderEvent(provider: string, eventId: string): Promise<MultiBotProviderEvent | undefined>;

    updateChatOption(chatId: number, option: string, value: any): Promise<void>;

    getChatOption<T = any>(chatId: number, option: string): Promise<T | undefined>;
}
