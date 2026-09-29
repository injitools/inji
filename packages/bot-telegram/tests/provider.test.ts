import {describe, test, expect, vi} from "vitest";

import {MultiBot, MultiBotMemoryStorage, MultiBotMessage, MultiBotMessageType} from "@injitools/bot";
import {
    MultiBotTelegramProvider,
    TelegramApi,
    TelegramApiError,
    TelegramApiUserType,
    type ITelegramGetUpdatesResultItem,
} from "@injitools/bot-telegram";

const from = {id: 500, is_bot: false, first_name: 'Ann', username: 'ann', language_code: 'ru', is_premium: false};

function textUpdate(update_id: number, text: string, chatId = 500): ITelegramGetUpdatesResultItem {
    return {update_id, message: {message_id: update_id * 10, from, chat: {id: chatId, type: 'private'}, date: 1_700_000_000, text}};
}

function callbackUpdate(update_id: number, data: object): ITelegramGetUpdatesResultItem {
    return {
        update_id,
        callback_query: {
            id: `cb${update_id}`,
            from,
            chat_instance: 'x',
            data: JSON.stringify(data),
            message: {message_id: 1, from, chat: {id: 500, type: 'private'}, date: 1_700_000_000, text: 'old'},
        },
    };
}

/** A stubbed Bot API: no network — every method is a vi.fn on a real TelegramApi instance. */
function stubApi(updates: ITelegramGetUpdatesResultItem[][] = []) {
    const api = new TelegramApi('token');
    const queue = [...updates];
    vi.spyOn(api, 'getUpdates').mockImplementation(async () => queue.shift() ?? []);
    vi.spyOn(api, 'sendMessage').mockResolvedValue({message_id: 900});
    vi.spyOn(api, 'sendPhoto').mockResolvedValue({message_id: 901});
    vi.spyOn(api, 'editMessageText').mockResolvedValue(undefined);
    vi.spyOn(api, 'sendChatAction').mockResolvedValue({});
    vi.spyOn(api, 'getMe').mockResolvedValue({id: 7, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false});
    return api;
}

function setup(updates?: ITelegramGetUpdatesResultItem[][]) {
    const storage = new MultiBotMemoryStorage();
    const logger = {error: vi.fn(), warn: vi.fn()};
    const bot = new MultiBot(storage, {logger});
    const api = stubApi(updates);
    // sendIntervalMs: 0 — no throttling in tests
    const provider = new MultiBotTelegramProvider(7, TelegramApiUserType.Bot, api, {sendIntervalMs: 0});
    bot.addProvider(provider);
    return {bot, storage, api, provider, logger};
}

describe("MultiBotTelegramProvider — incoming", () => {
    test("fromApi resolves the bot id through getMe", async () => {
        const api = stubApi();
        const provider = await MultiBotTelegramProvider.fromApi(api);
        expect(provider.name).toBe('telegram:bot:7');
    });

    test("pullUpdates asks from the persisted offset+1 with a seconds timeout, dispatches, advances the offset", async () => {
        const {bot, api, provider, storage} = setup([[textUpdate(3, 'hello'), textUpdate(4, '/start ref')]]);
        const texts: string[] = [];
        const commands: string[] = [];
        bot.message('*', async (m) => {
            texts.push(m.text);
        });
        bot.command('start', async (_c, m) => {
            commands.push(m.payload.args.join(','));
        });
        await storage.updateProviderOption(provider.name, 'lastUpdate', 2);

        await provider.pullUpdates();

        expect(api.getUpdates).toHaveBeenCalledWith({offset: 3, timeout: 25});
        expect(texts).toEqual(['hello']);
        expect(commands).toEqual(['ref']);
        expect(await storage.getProviderOption(provider.name, 'lastUpdate')).toBe(4);
        // a second pull with an empty answer keeps the offset
        await provider.pullUpdates();
        expect(api.getUpdates).toHaveBeenLastCalledWith({offset: 5, timeout: 25});
    });

    test("first pull starts from offset 0", async () => {
        const {api, provider} = setup([[]]);
        await provider.pullUpdates();
        expect(api.getUpdates).toHaveBeenCalledWith({offset: 0, timeout: 25});
    });

    test("a text message becomes a MultiBot message with peer, chat providerId and sender context", async () => {
        const {bot, provider} = setup();
        let seen: MultiBotMessage;
        bot.message('*', async (m) => {
            seen = m;
        });
        await provider.handleUpdate(textUpdate(1, 'hi', -100));
        expect(seen.from).toBe('telegram:user:500');
        expect(seen.to).toBe('telegram:bot:7');
        expect(seen.providerId).toBe('10');
        expect(seen.date).toEqual(new Date(1_700_000_000 * 1000));
        expect(seen.chat.providerId).toBe('telegram:bot:7:-100');
        expect(seen.chat.peer).toBe('telegram:user:500');
        expect(seen.context).toEqual({language: 'ru', first_name: 'Ann', username: 'ann', is_premium: false});
        expect(provider.chatIdOf(seen.chat)).toBe(-100);
    });

    test("a callback_query becomes a command with the button's payload", async () => {
        const {bot, provider} = setup();
        const calls: any[] = [];
        bot.command('answered', async (_c, m) => {
            calls.push(m.payload.args);
        });
        const m = await provider.handleUpdate(callbackUpdate(2, {command: 'answered', args: {id: 9}}));
        expect(m.type).toBe(MultiBotMessageType.Command);
        expect(m.providerId).toBe('cb2');
        expect(calls).toEqual([{id: 9}]);
    });

    test("updates without text or callback (a sticker, a pre_checkout_query) are recorded and skipped", async () => {
        const {bot, provider, storage} = setup();
        const handler = vi.fn(async () => {
        });
        bot.message('*', handler);
        await provider.handleUpdate({update_id: 5, message: {message_id: 1, from, chat: {id: 500, type: 'private'}, date: 1}});
        expect(handler).not.toHaveBeenCalled();
        expect((await storage.getProviderEvent(provider.name, '5')).executed).toBe(true);
    });
});

describe("MultiBotTelegramProvider — outgoing", () => {
    async function chatOf(bot: MultiBot, provider: MultiBotTelegramProvider) {
        let chat;
        bot.message('*', async (m) => {
            chat = m.chat;
        });
        await provider.handleUpdate(textUpdate(1, 'hi'));
        return chat;
    }

    test("sendMessage renders MarkdownV2 (auto-escaped), inline keyboard, stores the message with the returned id", async () => {
        const {bot, api, provider, storage} = setup();
        const chat = await chatOf(bot, provider);

        const sent = await chat.sendMessage(t => t.text('Hello, world.').keyboard(k => {
            k.inline();
            k.line().button('Yes').command('answered', {id: 1});
            k.line().button('Site').link('https://s');
        }));

        expect(api.sendMessage).toHaveBeenCalledWith(500, 'Hello, world\\.', 'MarkdownV2', {
            inline_keyboard: [
                [{text: 'Yes', callback_data: '{"command":"answered","args":{"id":1}}'}],
                [{text: 'Site', url: 'https://s'}],
            ],
        });
        expect(sent.providerId).toBe('900');
        expect(sent.text).toBe('Hello, world.');
        expect(storage.messages.map(m => m.providerId)).toContain('900');
    });

    test("a reply keyboard gets resize_keyboard and plain text buttons; on an inline one they are dropped with a warning", async () => {
        const {bot, api, provider, logger} = setup();
        const chat = await chatOf(bot, provider);

        await chat.sendMessage(t => t.text('menu').keyboard(k => {
            k.line().button('Статус');
        }));
        expect(api.sendMessage).toHaveBeenLastCalledWith(500, 'menu', 'MarkdownV2', {keyboard: [[{text: 'Статус'}]], resize_keyboard: true});

        await chat.sendMessage(t => t.text('menu').keyboard(k => {
            k.inline().line().button('Plain');
        }));
        expect(api.sendMessage).toHaveBeenLastCalledWith(500, 'menu', 'MarkdownV2', {inline_keyboard: [[]]});
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test("image attachments are sent after the text", async () => {
        const {bot, api, provider} = setup();
        const chat = await chatOf(bot, provider);
        await chat.sendMessage(t => t.text('pic').image('cap', '/tmp/a.png'));
        expect(api.sendPhoto).toHaveBeenCalledWith(500, '/tmp/a.png', 'cap');
    });

    test("a 403 reports the chat as blocked and is re-thrown; a success reports it reachable", async () => {
        const {bot, api, provider} = setup();
        const blocked = vi.fn(async () => {
        });
        bot.onBlocked(blocked);
        const chat = await chatOf(bot, provider);
        blocked.mockClear();

        vi.mocked(api.sendMessage).mockRejectedValueOnce(new TelegramApiError('Forbidden: bot was blocked by the user', 403));
        await expect(chat.sendMessage('x')).rejects.toBeInstanceOf(TelegramApiError);
        expect(blocked).toHaveBeenCalledWith(expect.objectContaining({id: chat.id}), true);

        await chat.sendMessage('y');
        expect(blocked).toHaveBeenLastCalledWith(expect.objectContaining({id: chat.id}), false);
    });

    test("a 400 (bad markup) is re-thrown without a block report", async () => {
        const {bot, api, provider} = setup();
        const blocked = vi.fn(async () => {
        });
        bot.onBlocked(blocked);
        const chat = await chatOf(bot, provider);
        blocked.mockClear();
        vi.mocked(api.sendMessage).mockRejectedValueOnce(new TelegramApiError("Bad Request: can't parse entities", 400));
        await expect(chat.sendMessage('x')).rejects.toThrow(/parse entities/);
        expect(blocked).not.toHaveBeenCalled();
    });

    test("editMessage and setTypingStatus address the chat by its Telegram id", async () => {
        const {bot, api, provider} = setup();
        const chat = await chatOf(bot, provider);
        const sent = await chat.sendMessage('a');
        await sent.edit('b.');
        expect(api.editMessageText).toHaveBeenCalledWith(500, '900', 'b\\.', 'MarkdownV2');
        expect(sent.text).toBe('b.');
        await chat.setTypingStatus();
        expect(api.sendChatAction).toHaveBeenCalledWith(500, 'typing');
    });

    test("throttles consecutive sends by sendIntervalMs", async () => {
        const storage = new MultiBotMemoryStorage();
        const bot = new MultiBot(storage, {logger: {error: vi.fn(), warn: vi.fn()}});
        const api = stubApi();
        const provider = new MultiBotTelegramProvider(7, TelegramApiUserType.Bot, api, {sendIntervalMs: 40});
        bot.addProvider(provider);
        const chat = await chatOf(bot, provider);
        const t0 = Date.now();
        await chat.sendMessage('1');
        await chat.sendMessage('2');
        await chat.sendMessage('3');
        expect(Date.now() - t0).toBeGreaterThanOrEqual(75);
    });
});

describe("TelegramApiError", () => {
    test("isBlocked on 403 and on the known 400 texts only", () => {
        expect(new TelegramApiError('Forbidden: bot was blocked by the user', 403).isBlocked).toBe(true);
        expect(new TelegramApiError('Bad Request: chat not found', 400).isBlocked).toBe(true);
        expect(new TelegramApiError("Bad Request: can't parse entities", 400).isBlocked).toBe(false);
    });
});
