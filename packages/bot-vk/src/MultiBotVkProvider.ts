import {
    ButtonType,
    MultiBot,
    MultiBotChat,
    MultiBotMessage,
    type IMultiBotSocialProvider,
    type ParsedIncoming,
} from "@injitools/bot";

import VkApi from "./VkApi.js";
import VkApiError from "./VkApiError.js";
import {VkApiEvent, VkApiUserType, type TVkApiEvents, type TVkApiLongPollServer, type VkSenderContext} from "./types.js";

export interface VkProviderOptions {
    /** Long-poll wait, in seconds. Default 25. */
    pollWaitSec?: number;
    /** Storage key of the cached long-poll server. Default 'longPollServer'. */
    serverOption?: string;
}

/**
 * VK social provider for MultiBot (community bot). Runs Bots Long Poll (server/key/ts cached
 * in the storage), turns `message_new` / `message_event` into MultiBot messages, maps
 * `message_allow` / `message_deny` to the blocked hook, renders templates as plain text with
 * VK keyboards, uploads image attachments.
 *
 * Provider name: `vk:<bot|user>:<uid>`; peers: `vk:user:<user id>`; chats are addressed by peer
 * (no providerId).
 */
export default class MultiBotVkProvider implements IMultiBotSocialProvider {
    public msgFormats = ['text'];
    public name: string;
    public bot: MultiBot;
    private readonly pollWaitSec: number;
    private readonly serverOption: string;

    constructor(
        public uid: number,
        public type: VkApiUserType,
        public api: VkApi,
        options: VkProviderOptions = {},
    ) {
        this.name = `vk:${type}:${uid}`;
        this.pollWaitSec = options.pollWaitSec ?? 25;
        this.serverOption = options.serverOption ?? 'longPollServer';
    }

    // ── Incoming ─────────────────────────────────────────────────────────────────

    async pullUpdates() {
        const config = await this.getLongPollConfig();
        const result = await this.api.longPoll(config.server, config.key, config.ts, this.pollWaitSec);

        if (!result.updates) {
            // failed=1: history is out of date, retry with the new ts; 2/3: key/server expired —
            // re-request the server. See https://dev.vk.com/api/bots-long-poll/getting-started
            if (result.failed === 1 && result.ts) {
                config.ts = result.ts;
                await this.saveLongPollConfig(config);
                return this.pullUpdates();
            } else if (result.failed) {
                await this.getLongPollConfig(false);
                return this.pullUpdates();
            }
            throw new Error('vk pull updates: ' + JSON.stringify(result));
        }
        await this.handleUpdates(result.updates);
        config.ts = result.ts;
        await this.saveLongPollConfig(config);
    }

    /** A batch of updates through the shared pipeline (also the entry point for a Callback API webhook). */
    async handleUpdates(updates: TVkApiEvents[]) {
        for (const update of updates) {
            await this.bot.ingest(this, {eventId: update.event_id, type: update.type, data: update.object}, () => this.parseUpdate(update));
        }
    }

    private async parseUpdate(update: TVkApiEvents): Promise<ParsedIncoming<any, any, VkSenderContext> | null> {
        switch (update.type) {
            case VkApiEvent.MessageDeny:
            case VkApiEvent.MessageAllow: {
                const chat = await this.bot.getChatByPeers(this.name, `vk:${VkApiUserType.User}:${update.object.user_id}`);
                await this.bot.reportBlocked(chat, update.type === VkApiEvent.MessageDeny);
                return null;
            }
            case VkApiEvent.MessageEvent: {
                const o = update.object;
                // Acknowledge the callback button so the client stops its spinner.
                await this.api.call('messages.sendMessageEventAnswer', {
                    event_id: o.event_id,
                    peer_id: o.peer_id,
                    user_id: o.user_id,
                    conversation_message_id: o.conversation_message_id,
                });
                return {
                    providerId: o.event_id,
                    from: `vk:${VkApiUserType.User}:${o.peer_id}`,
                    payload: o.payload,
                    date: new Date(),
                    meta: o,
                };
            }
            case VkApiEvent.MessageNew: {
                const m = update.object.message;
                const langId = update.object.client_info?.lang_id;
                return {
                    providerId: m.id.toString(),
                    from: `vk:${VkApiUserType.User}:${m.from_id}`,
                    text: m.text,
                    date: new Date(m.date * 1000),
                    // A button payload wins over `/command` text.
                    payload: m.payload ? JSON.parse(m.payload) : undefined,
                    meta: update.object,
                    context: {language: langId === 0 ? "ru" : langId?.toString()},
                };
            }
            default:
                return null;
        }
    }

    async getLongPollConfig(cached = true): Promise<TVkApiLongPollServer> {
        let server = cached ? await this.bot.storage.getProviderOption<TVkApiLongPollServer>(this.name, this.serverOption) : undefined;
        if (!server) {
            const method = this.type === VkApiUserType.Bot ? 'groups.getLongPollServer' : 'messages.getLongPollServer';
            server = await this.api.call<TVkApiLongPollServer>(method, {group_id: this.uid});
            await this.saveLongPollConfig(server);
        }
        return server;
    }

    async saveLongPollConfig(config: TVkApiLongPollServer) {
        await this.bot.storage.updateProviderOption(this.name, this.serverOption, config);
    }

    // ── Outgoing ─────────────────────────────────────────────────────────────────

    userIdOf(peer: string): string {
        return peer.split(':')[2];
    }

    buildKeyboard(message: MultiBotMessage): {inline: boolean, buttons: any[][]} | undefined {
        const kb = message.template?.keyboardBuilder;
        if (!kb) {
            return undefined;
        }
        const keyboard = {inline: !!kb.isInline, buttons: [] as any[][]};
        for (const line of kb.lines) {
            const buttons: any[] = [];
            for (const button of line.buttons) {
                switch (button.type) {
                    case ButtonType.COMMAND:
                        buttons.push({
                            action: {
                                type: 'callback',
                                label: button.text,
                                payload: JSON.stringify({command: button.commandName, args: button.commandArgs}),
                            },
                        });
                        break;
                    case ButtonType.LINK:
                        buttons.push({action: {type: 'open_link', label: button.text, link: button.url}});
                        break;
                    default:
                        buttons.push({action: {type: 'text', label: button.text}});
                }
            }
            keyboard.buttons.push(buttons);
        }
        return keyboard;
    }

    async sendMessage(message: MultiBotMessage): Promise<MultiBotMessage> {
        if (!message.to || message.to.indexOf('vk:') !== 0) {
            throw new Error('VkSendMessage: empty to or invalid provider');
        }

        if (message.meta === null) {
            message.meta = {};
        }
        message.meta.random_id = Date.now();

        const text = message.text || message.template.build(this.msgFormats[0]);
        const keyboard = this.buildKeyboard(message);
        const userId = this.userIdOf(message.to);
        const params: Record<string, any> = {
            user_id: userId,
            random_id: message.meta.random_id,
            message: text,
            dont_parse_links: 1,
        };
        if (keyboard) {
            params.keyboard = JSON.stringify(keyboard);
        }
        const attachments: string[] = [];
        for (const attachment of message.template.attachments) {
            if (attachment.type === 'image') {
                attachments.push(await this.api.uploadMessagePhoto(userId, attachment.path));
            }
        }
        if (attachments.length) {
            params.attachment = attachments.join(',');
        }

        // Stored before the send so the random_id survives a crash mid-request (VK dedups on it).
        await this.bot.storage.saveMessage(message);
        try {
            const id = await this.api.call<number>('messages.send', params);
            message.providerId = id?.toString();
        } catch (e) {
            if (e instanceof VkApiError && e.isBlocked) {
                await this.bot.reportBlocked(message.chat, true);
            }
            throw e;
        }
        await this.bot.reportBlocked(message.chat, false);
        message.text = text;
        await this.bot.storage.saveMessage(message);

        return message;
    }

    async editMessage(_message: MultiBotMessage, _text: string): Promise<MultiBotMessage> {
        throw new Error('MultiBotVkProvider.editMessage is not implemented');
    }

    async setTypingStatus(chat: MultiBotChat): Promise<any> {
        await this.api.call('messages.setActivity', {
            user_id: this.userIdOf(chat.peer),
            type: 'typing',
        });
    }
}
