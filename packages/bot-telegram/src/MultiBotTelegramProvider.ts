import {
    ButtonType,
    MultiBot,
    MultiBotChat,
    MultiBotMessage,
    type IMultiBotSocialProvider,
    type ParsedIncoming,
} from "@injitools/bot";

import TelegramApi from "./TelegramApi.js";
import {TelegramApiError} from "./TelegramApiError.js";
import {ensureMarkdownV2} from "./markdownV2.js";
import {
    TelegramApiUserType,
    type ITelegramGetUpdatesResultItem,
    type TelegramSenderContext,
    type TTelegramKeyboardButton,
    type TTelegramReplyMarkup,
} from "./types.js";

export interface TelegramProviderOptions {
    /** Minimum gap between two API sends (Telegram's ~20 msg/min per chat). Default 3000. */
    sendIntervalMs?: number;
    /** Long-poll wait of getUpdates, in SECONDS. Default 25. */
    pollTimeoutSec?: number;
    /** Storage key of the last consumed update_id. Default 'lastUpdate'. */
    offsetOption?: string;
}

/**
 * Telegram social provider for MultiBot. Long-polls getUpdates (offset persisted in the
 * storage), turns `message` / `callback_query` updates into MultiBot messages, renders
 * templates as MarkdownV2 (auto-escaped) with inline or reply keyboards, and reports a block
 * on a 403 from sendMessage.
 *
 * Provider name: `telegram:<bot|user>:<uid>`; peers: `telegram:<bot|user>:<from.id>`;
 * chat providerId: `<provider name>:<chat.id>`.
 */
export default class MultiBotTelegramProvider implements IMultiBotSocialProvider {
    bot: MultiBot;
    msgFormats: string[] = ['MarkdownV2', 'html', 'text', 'Markdown'];
    name: string;
    private lastSend = 0;
    private readonly sendIntervalMs: number;
    private readonly pollTimeoutSec: number;
    private readonly offsetOption: string;

    constructor(
        public uid: number,
        public type: TelegramApiUserType,
        public api: TelegramApi,
        options: TelegramProviderOptions = {},
    ) {
        this.name = `telegram:${type}:${uid}`;
        this.sendIntervalMs = options.sendIntervalMs ?? 3000;
        this.pollTimeoutSec = options.pollTimeoutSec ?? 25;
        this.offsetOption = options.offsetOption ?? 'lastUpdate';
    }

    /** Resolves the bot's own id through getMe. */
    static async fromApi(api: TelegramApi, options?: TelegramProviderOptions) {
        const me = await api.getMe();
        return new MultiBotTelegramProvider(me.id, me.is_bot ? TelegramApiUserType.Bot : TelegramApiUserType.User, api, options);
    }

    // ── Incoming ─────────────────────────────────────────────────────────────────

    async pullUpdates() {
        const lastUpdate = await this.bot.storage.getProviderOption<number>(this.name, this.offsetOption) ?? -1;
        const updates = await this.api.getUpdates({
            offset: lastUpdate + 1,
            timeout: this.pollTimeoutSec,
        });
        for (const update of updates) {
            await this.handleUpdate(update);
            await this.bot.storage.updateProviderOption(this.name, this.offsetOption, update.update_id);
        }
    }

    /** One update through the shared pipeline (also the entry point for a webhook). */
    handleUpdate(update: ITelegramGetUpdatesResultItem) {
        return this.bot.ingest(this, {eventId: update.update_id.toString(), type: '', data: update}, () => this.parseUpdate(update));
    }

    chatIdOf(chat: MultiBotChat): number {
        return +chat.providerId.replace(this.name + ':', '');
    }

    private senderContext(from: ITelegramGetUpdatesResultItem['message']['from']): TelegramSenderContext {
        return {
            language: from.language_code,
            first_name: from.first_name,
            username: from.username,
            is_premium: from.is_premium,
        };
    }

    private parseUpdate(update: ITelegramGetUpdatesResultItem): ParsedIncoming<any, any, TelegramSenderContext> | null {
        if (update.callback_query) {
            const cq = update.callback_query;
            return {
                providerId: cq.id.toString(),
                from: `telegram:${cq.from.is_bot ? 'bot' : 'user'}:${cq.from.id}`,
                chatProviderId: `${this.name}:${cq.message.chat.id}`,
                payload: JSON.parse(cq.data),
                date: new Date(),
                context: this.senderContext(cq.from),
            };
        }
        if (update.message?.text) {
            const m = update.message;
            return {
                providerId: m.message_id.toString(),
                from: `telegram:${m.from.is_bot ? 'bot' : 'user'}:${m.from.id}`,
                chatProviderId: `${this.name}:${m.chat.id}`,
                text: m.text,
                date: new Date(m.date * 1000),
                context: this.senderContext(m.from),
            };
        }
        // Service updates, media without a caption, pre_checkout_query … — nothing to dispatch.
        return null;
    }

    // ── Outgoing ─────────────────────────────────────────────────────────────────

    buildReplyMarkup(message: MultiBotMessage): TTelegramReplyMarkup | undefined {
        const kb = message.template?.keyboardBuilder;
        if (!kb) {
            return undefined;
        }
        const keyboardType = kb.isInline ? 'inline_keyboard' : 'keyboard';
        const reply_markup: TTelegramReplyMarkup = {[keyboardType]: []};
        if (!kb.isInline) {
            reply_markup.resize_keyboard = true;
        }
        for (const line of kb.lines) {
            const buttons: TTelegramKeyboardButton[] = [];
            for (const button of line.buttons) {
                switch (button.type) {
                    case ButtonType.COMMAND:
                        buttons.push({
                            text: button.text,
                            callback_data: JSON.stringify({command: button.commandName, args: button.commandArgs}),
                        });
                        break;
                    case ButtonType.LINK:
                        buttons.push({text: button.text, url: button.url});
                        break;
                    default:
                        // A plain text button exists only on reply keyboards; Telegram rejects an
                        // inline button without url/callback_data, so it is dropped — loudly.
                        if (kb.isInline) {
                            this.bot.logger.warn(`MultiBotTelegramProvider: inline keyboard cannot hold a plain text button "${button.text}", use .command() or .link()`);
                        } else {
                            buttons.push({text: button.text});
                        }
                }
            }
            reply_markup[keyboardType].push(buttons);
        }
        return reply_markup;
    }

    async sendMessage(message: MultiBotMessage): Promise<MultiBotMessage> {
        if (!message.to || message.to.indexOf('telegram:') !== 0) {
            throw new Error('TelegramSendMessage: empty to or invalid provider');
        }
        const chatId = this.chatIdOf(message.chat);
        const text = message.template.build(this.msgFormats[0]);
        const reply_markup = this.buildReplyMarkup(message);

        await this.waitOrder();
        message.text = text;
        // A 403 is the only reliable sign that the peer blocked the bot: the Bot API cannot be
        // asked, it is learnt at send time. The error is NOT swallowed — the caller must see that
        // the message did not go out.
        let message_id: number;
        try {
            ({message_id} = await this.api.sendMessage(chatId, ensureMarkdownV2(text), 'MarkdownV2', reply_markup));
        } catch (e) {
            if (e instanceof TelegramApiError && e.isBlocked) {
                await this.bot.reportBlocked(message.chat, true);
            }
            throw e;
        }
        await this.bot.reportBlocked(message.chat, false);
        message.providerId = message_id.toString();
        await this.bot.storage.saveMessage(message);
        for (const attachment of message.template.attachments) {
            if (attachment.type === 'image') {
                await this.waitOrder();
                await this.api.sendPhoto(chatId, attachment.path, attachment.caption);
            }
        }
        return message;
    }

    async editMessage(message: MultiBotMessage, text: string): Promise<MultiBotMessage> {
        if (!message.to || message.to.indexOf('telegram:') !== 0) {
            throw new Error('TelegramEditMessage: empty to or invalid provider');
        }
        const chatId = this.chatIdOf(message.chat);
        await this.waitOrder();
        message.text = text;
        await this.api.editMessageText(chatId, message.providerId, ensureMarkdownV2(text), 'MarkdownV2');
        await this.bot.storage.saveMessage(message);
        return message;
    }

    async setTypingStatus(chat: MultiBotChat): Promise<any> {
        await this.waitOrder();
        return this.api.sendChatAction(this.chatIdOf(chat), 'typing');
    }

    /** Serializes sends: at most one API call per `sendIntervalMs`. */
    private async waitOrder() {
        while (Date.now() - this.lastSend < this.sendIntervalMs) {
            await new Promise(resolve => setTimeout(resolve, this.sendIntervalMs - (Date.now() - this.lastSend)));
        }
        this.lastSend = Date.now();
    }
}
