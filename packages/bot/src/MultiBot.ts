import type IMultiBotSocialProvider from "./interfaces/IMultiBotSocialProvider.js";
import type IMultiBotStorageProvider from "./interfaces/IMultiBotStorageProvider.js";
import MultiBotMessage, {MultiBotCommandPayload} from "./MultiBotMessage.js";
import MultiBotChat from "./MultiBotChat.js";
import MultiBotProviderEvent from "./MultiBotProviderEvent.js";
import {MultiBotMessageType} from "./MultiBotMessageType.js";

export type MultiBotMessageHandler = (message: MultiBotMessage) => Promise<void>;
export type MultiBotCommandHandler = (command: string, message: MultiBotMessage) => Promise<void>;
export type MultiBotInputHandler = (input: string, message: MultiBotMessage) => Promise<void>;
/** Called with `true` when a provider learns the peer blocked the bot, `false` on every proof of the opposite. */
export type MultiBotBlockedHandler = (chat: MultiBotChat, blocked: boolean) => Promise<void>;

export interface MultiBotLogger {
    error(...args: any[]): void;
    warn(...args: any[]): void;
}

export interface MultiBotOptions {
    /** Where unhandled inputs, unknown commands and failed updates are reported. Default: console. */
    logger?: MultiBotLogger;
}

/** One raw update as received from the messenger, before parsing. */
export interface IncomingEvent<T = any> {
    /** Provider-side unique id of the update (Telegram `update_id`, VK `event_id`). */
    eventId: string;
    /** Provider-side kind of the update, for the audit record; '' when the messenger has none. */
    type?: string;
    /** The update verbatim — stored as is, so a parser fix never needs a re-fetch. */
    data: T;
}

/**
 * What a provider extracted from a raw update. Returning `null`/`undefined` from the parser marks
 * the event handled with nothing to dispatch (service events, unsupported update kinds).
 */
export interface ParsedIncoming<P = any, T = any, C = any> {
    /** Provider-side message id. */
    providerId: string;
    /** Sender peer, `<provider>:<kind>:<id>`. */
    from: string;
    /**
     * Provider-scoped chat id, for messengers where a chat is not the same thing as a peer
     * (Telegram groups). Omit to address the chat by `from` (VK).
     */
    chatProviderId?: string;
    text?: string | null;
    date?: Date;
    /** Explicit command (a callback button). When absent, `/command args` text is parsed into one. */
    payload?: MultiBotCommandPayload<P> | null;
    meta?: T | null;
    context?: C | null;
}

/** `/cmd a b` → `{command: 'cmd', args: ['a', 'b']}`; anything else → null. */
export function parseCommandText(text: string | null | undefined): MultiBotCommandPayload<string[]> | null {
    if (!text || text.indexOf('/') !== 0) return null;
    const parts = text.split(' ').filter(p => !!p.trim());
    return {command: parts[0].substring(1), args: parts.slice(1)};
}

/**
 * The messenger-agnostic bot: handlers for commands, messages and awaited inputs, dispatch, and
 * the shared "one raw update → one stored, deduplicated, dispatched message" pipeline (`ingest`)
 * that every social provider goes through. Providers only map their update format into
 * ParsedIncoming and render outgoing messages.
 */
export default class MultiBot {
    private providers: {[name: string]: IMultiBotSocialProvider} = {};

    private commandHandler: {[command: string]: MultiBotCommandHandler} = {};
    private inputHandler: {[input: string]: MultiBotInputHandler} = {};
    private messageHandler: {[message: string]: MultiBotMessageHandler} = {};
    private blockedHandler: MultiBotBlockedHandler | undefined;

    readonly logger: MultiBotLogger;

    constructor(
        public storage: IMultiBotStorageProvider,
        options: MultiBotOptions = {},
    ) {
        this.logger = options.logger ?? console;
    }

    // ── Providers ────────────────────────────────────────────────────────────────

    addProvider(provider: IMultiBotSocialProvider) {
        provider.bot = this;
        this.providers[provider.name] = provider;
        return this;
    }

    getProviders() {
        return this.providers;
    }

    getProvider(name: string): IMultiBotSocialProvider | undefined {
        return this.providers[name];
    }

    // ── Handlers ─────────────────────────────────────────────────────────────────

    /** Exact (trimmed, lower-cased) text, or `'*'` for everything unmatched. */
    message(message: string, handler: MultiBotMessageHandler) {
        this.messageHandler[message] = handler;
        return this;
    }

    command(command: string, handler: MultiBotCommandHandler) {
        this.commandHandler[command] = handler;
        return this;
    }

    /** Handler for the next message after `message.requestInput(input, …)`. */
    input(input: string, handler: MultiBotInputHandler) {
        this.inputHandler[input] = handler;
        return this;
    }

    /**
     * Blocked-state hook. Telegram only reveals a block by refusing a send (403); VK sends
     * message_allow/message_deny. Providers report both edges here; without a handler nothing is
     * recorded. Called with `false` on every proof of reachability (an incoming message, a
     * successful send), so the handler decides whether a write is needed.
     */
    onBlocked(handler: MultiBotBlockedHandler) {
        this.blockedHandler = handler;
        return this;
    }

    async reportBlocked(chat: MultiBotChat | undefined, blocked: boolean) {
        if (!this.blockedHandler || !chat?.id) return;
        await this.blockedHandler(chat, blocked);
    }

    // ── Dispatch ─────────────────────────────────────────────────────────────────

    async handleInput(input: string, message: MultiBotMessage) {
        if (this.inputHandler[input]) {
            await this.inputHandler[input](input, message);
        } else {
            this.logger.error('MultiBot: no handler for input', input, message.text);
        }
    }

    async handleMessage(message: MultiBotMessage) {
        const input = await message.chat.isWaitInput();
        if (input) {
            await message.chat.waitInput(false);
            await this.handleInput(input, message);
            return;
        }
        const key = (message.text ?? '').trim().toLowerCase();
        if (this.messageHandler[key]) {
            await this.messageHandler[key](message);
        } else if (this.messageHandler['*']) {
            await this.messageHandler['*'](message);
        }
    }

    async handleCommand(command: string, message: MultiBotMessage) {
        if (this.commandHandler[command]) {
            await this.commandHandler[command](command, message);
        } else {
            this.logger.error('MultiBot: unknown command', command);
        }
    }

    /** Route a message by its type (what `ingest` does after storing it). */
    async dispatch(message: MultiBotMessage) {
        switch (message.type) {
            case MultiBotMessageType.Command:
                await this.handleCommand(message.payload.command, message);
                break;
            default:
                await this.handleMessage(message);
        }
    }

    // ── Incoming pipeline ────────────────────────────────────────────────────────

    /**
     * The shared incoming pipeline. Dedups by (provider, eventId), stores the raw event, lets the
     * provider parse it, finds or creates the chat, stores the message, reports the peer as
     * reachable, dispatches, and marks the event executed. A throwing handler does not stop the
     * poll loop: the error is logged AND kept on the stored event (`error`), which stays
     * `executed: false` — the failure is visible in the table, not swallowed.
     *
     * Returns the message when one was dispatched.
     */
    async ingest<P = any, T = any, C = any>(
        provider: IMultiBotSocialProvider,
        event: IncomingEvent,
        parse: (event: IncomingEvent) => Promise<ParsedIncoming<P, T, C> | null | undefined> | ParsedIncoming<P, T, C> | null | undefined,
    ): Promise<MultiBotMessage<P, T, C> | undefined> {
        let providerEvent = await this.storage.getProviderEvent(provider.name, event.eventId);
        if (providerEvent?.executed) {
            return undefined;
        }
        if (!providerEvent) {
            providerEvent = new MultiBotProviderEvent();
            providerEvent.provider = provider.name;
            providerEvent.eventId = event.eventId;
            providerEvent.date = new Date();
            providerEvent.type = event.type ?? '';
            providerEvent.data = event.data;
            providerEvent.executed = false;
            await this.storage.saveProviderEvent(providerEvent);
        }

        try {
            const parsed = await parse(event);
            if (!parsed) {
                providerEvent.executed = true;
                await this.storage.saveProviderEvent(providerEvent);
                return undefined;
            }

            const message = new MultiBotMessage<P, T, C>();
            message.providerEvent = providerEvent;
            message.to = provider.name;
            message.from = parsed.from;
            message.providerId = parsed.providerId;
            message.text = parsed.text ?? null;
            message.date = parsed.date ?? new Date();
            message.meta = parsed.meta ?? null;
            message.context = parsed.context ?? null;
            message.payload = parsed.payload ?? (parseCommandText(message.text) as MultiBotCommandPayload<P> | null);
            message.type = message.payload ? MultiBotMessageType.Command : MultiBotMessageType.Message;

            message.chat = await this.resolveChat(provider, parsed.from, parsed.chatProviderId);

            await this.storage.saveMessage(message);
            // The peer writes to the bot — so it has not blocked it (or has unblocked it).
            await this.reportBlocked(message.chat, false);

            await this.dispatch(message);

            providerEvent.executed = true;
            await this.storage.saveProviderEvent(providerEvent);
            return message;
        } catch (e) {
            this.logger.error(`MultiBot: ${provider.name} update ${event.eventId} failed`, e);
            providerEvent.error = `${e?.constructor?.name ?? 'Error'}: ${e?.message ?? e}\n\n${e?.stack ?? ''}`;
            await this.storage.saveProviderEvent(providerEvent);
            return undefined;
        }
    }

    // ── Chats ────────────────────────────────────────────────────────────────────

    /** Bind a storage-loaded chat to this bot and its provider. */
    attachChat(chat: MultiBotChat, provider?: IMultiBotSocialProvider) {
        chat.bot = this;
        chat.provider = provider ?? this.providers[chat.providerName];
        return chat;
    }

    private async resolveChat(provider: IMultiBotSocialProvider, peer: string, chatProviderId?: string) {
        if (!chatProviderId) {
            return this.getChatByPeers(provider.name, peer);
        }
        let chat = await this.getChatByProviderId(provider.name, chatProviderId);
        if (!chat) {
            chat = new MultiBotChat();
            chat.providerId = chatProviderId;
            chat.providerName = provider.name;
            chat.peer = peer;
            this.attachChat(chat, provider);
            await this.storage.saveChat(chat);
        }
        return chat;
    }

    async getChatByPeers(provider: string, peer: string) {
        const chat = await this.storage.getChatByPeers(provider, peer);
        return this.attachChat(chat, this.providers[provider]);
    }

    async getChatByProviderId(provider: string, providerId: string) {
        const chat = await this.storage.getChatByProviderId(provider, providerId);
        return chat && this.attachChat(chat, this.providers[provider]);
    }

    async getChatById(chatId: number) {
        const chat = await this.storage.getChatById(chatId);
        return chat && this.attachChat(chat);
    }
}
