import {describe, test, expect, vi} from "vitest";

import {MultiBot, MultiBotMemoryStorage, MultiBotMessage, MultiBotMessageType} from "@injitools/bot";
import {MultiBotVkProvider, VkApi, VkApiError, VkApiUserType, type TVkApiEvents, type TVkApiLongPollResponse} from "@injitools/bot-vk";

function messageNew(event_id: string, text: string, extra: {payload?: string, lang_id?: number} = {}): TVkApiEvents {
    return {
        group_id: 1,
        type: 'message_new',
        event_id,
        v: '5.131',
        object: {
            message: {
                date: 1_700_000_000, from_id: 300, id: +event_id, out: 0, attachments: [], conversation_message_id: 1,
                fwd_messages: [], important: false, is_hidden: false, peer_id: 300, random_id: 0, text, payload: extra.payload,
            },
            client_info: {button_actions: ['text'], keyboard: true, inline_keyboard: true, carousel: false, lang_id: extra.lang_id ?? 0},
        },
    };
}

function messageEvent(event_id: string, payload: any): TVkApiEvents {
    return {group_id: 1, type: 'message_event', event_id, v: '5.131', object: {user_id: 300, peer_id: 300, event_id: `ev${event_id}`, payload, conversation_message_id: 2}};
}

/** A stubbed VK client: `call` answers by method name; `longPoll` pops queued responses. */
function stubApi(polls: TVkApiLongPollResponse[] = []) {
    const api = new VkApi('token');
    const queue = [...polls];
    const calls: [string, any][] = [];
    vi.spyOn(api, 'call').mockImplementation(async (method: string, params: any) => {
        calls.push([method, params]);
        switch (method) {
            case 'groups.getLongPollServer':
                return {server: 'https://lp', key: 'k' + calls.length, ts: '1'};
            case 'messages.send':
                return 4242;
            default:
                return {};
        }
    });
    vi.spyOn(api, 'longPoll').mockImplementation(async () => queue.shift() ?? {ts: '9', updates: []});
    vi.spyOn(api, 'uploadMessagePhoto').mockResolvedValue('photo1_2_abc');
    return {api, calls};
}

function setup(polls?: TVkApiLongPollResponse[]) {
    const storage = new MultiBotMemoryStorage();
    const logger = {error: vi.fn(), warn: vi.fn()};
    const bot = new MultiBot(storage, {logger});
    const {api, calls} = stubApi(polls);
    const provider = new MultiBotVkProvider(1, VkApiUserType.Bot, api);
    bot.addProvider(provider);
    return {bot, storage, api, calls, provider, logger};
}

describe("MultiBotVkProvider — long poll", () => {
    test("requests the server once, caches it, polls with its ts and persists the new ts", async () => {
        const {api, calls, provider, storage} = setup([{ts: '2', updates: []}, {ts: '3', updates: []}]);
        await provider.pullUpdates();
        await provider.pullUpdates();
        expect(calls.filter(([m]) => m === 'groups.getLongPollServer')).toHaveLength(1);
        expect(api.longPoll).toHaveBeenNthCalledWith(1, 'https://lp', 'k1', '1', 25);
        expect(api.longPoll).toHaveBeenNthCalledWith(2, 'https://lp', 'k1', '2', 25);
        expect(await storage.getProviderOption(provider.name, 'longPollServer')).toMatchObject({ts: '3'});
    });

    test("failed=1 retries with the returned ts; failed=2 re-requests the server", async () => {
        const {api, calls, provider} = setup([{failed: 1, ts: '7'}, {ts: '8', updates: []}, {failed: 2}, {ts: '9', updates: []}]);
        await provider.pullUpdates();
        expect(api.longPoll).toHaveBeenNthCalledWith(2, 'https://lp', 'k1', '7', 25);
        await provider.pullUpdates();
        expect(calls.filter(([m]) => m === 'groups.getLongPollServer')).toHaveLength(2);
        expect(api.longPoll).toHaveBeenNthCalledWith(4, 'https://lp', expect.stringMatching(/^k/), '1', 25);
    });

    test("an answer with neither updates nor failed is an error, not a silent skip", async () => {
        const {provider} = setup([{} as TVkApiLongPollResponse]);
        await expect(provider.pullUpdates()).rejects.toThrow(/vk pull updates/);
    });
});

describe("MultiBotVkProvider — incoming", () => {
    test("message_new becomes a text message addressed by peer, with meta and language", async () => {
        const {bot, provider} = setup();
        let seen: MultiBotMessage;
        bot.message('*', async (m) => {
            seen = m;
        });
        await provider.handleUpdates([messageNew('11', 'привет')]);
        expect(seen.from).toBe('vk:user:300');
        expect(seen.to).toBe('vk:bot:1');
        expect(seen.providerId).toBe('11');
        expect(seen.chat.peer).toBe('vk:user:300');
        expect(seen.chat.providerId).toBeNull();
        expect(seen.context).toEqual({language: 'ru'});
        expect(seen.meta.message.text).toBe('привет');
    });

    test("/command text and a button payload both dispatch commands; the payload wins", async () => {
        const {bot, provider} = setup();
        const calls: any[] = [];
        bot.command('start', async (_c, m) => {
            calls.push(['start', m.payload.args]);
        });
        bot.command('answered', async (_c, m) => {
            calls.push(['answered', m.payload.args]);
        });
        await provider.handleUpdates([
            messageNew('1', '/start  ref'),
            messageNew('2', 'Да', {payload: JSON.stringify({command: 'answered', args: {id: 3}})}),
        ]);
        expect(calls).toEqual([['start', ['ref']], ['answered', {id: 3}]]);
    });

    test("message_event is acknowledged and dispatched as a command", async () => {
        const {bot, provider, calls} = setup();
        const got: any[] = [];
        bot.command('answered', async (_c, m) => {
            got.push(m.payload.args);
        });
        const [m] = await Promise.all([provider.handleUpdates([messageEvent('5', {command: 'answered', args: 1})])]);
        expect(got).toEqual([1]);
        expect(calls).toContainEqual(['messages.sendMessageEventAnswer', {event_id: 'ev5', peer_id: 300, user_id: 300, conversation_message_id: 2}]);
        void m;
    });

    test("message_deny / message_allow report the block state through the hook", async () => {
        const {bot, provider} = setup();
        const blocked = vi.fn(async () => {
        });
        bot.onBlocked(blocked);
        await provider.handleUpdates([
            {group_id: 1, type: 'message_deny', event_id: 'd1', v: '5.131', object: {user_id: 300}},
            {group_id: 1, type: 'message_allow', event_id: 'a1', v: '5.131', object: {user_id: 300, key: 'k'}},
        ]);
        expect(blocked).toHaveBeenNthCalledWith(1, expect.objectContaining({peer: 'vk:user:300'}), true);
        expect(blocked).toHaveBeenNthCalledWith(2, expect.objectContaining({peer: 'vk:user:300'}), false);
    });

    test("a re-delivered event_id is skipped", async () => {
        const {bot, provider} = setup();
        const handler = vi.fn(async () => {
        });
        bot.message('*', handler);
        await provider.handleUpdates([messageNew('1', 'a')]);
        await provider.handleUpdates([messageNew('1', 'a')]);
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe("MultiBotVkProvider — outgoing", () => {
    async function chatOf(bot: MultiBot, provider: MultiBotVkProvider) {
        return bot.getChatByPeers(provider.name, 'vk:user:300');
    }

    test("sendMessage: text, keyboard JSON, attachments, random_id; stores the message with VK's id", async () => {
        const {bot, provider, calls, storage} = setup();
        const chat = await chatOf(bot, provider);
        const sent = await chat.sendMessage(t => t.text('Hi', 'bold').image('c', '/tmp/p.png').keyboard(k => {
            k.inline();
            k.line().button('Yes').command('answered', {id: 1});
            const l = k.line();
            l.button('Site').link('https://s');
            l.button('Plain');
        }));

        const [, params] = calls.find(([m]) => m === 'messages.send');
        expect(params).toMatchObject({user_id: '300', message: 'Hi', dont_parse_links: 1, attachment: 'photo1_2_abc'});
        expect(typeof params.random_id).toBe('number');
        expect(JSON.parse(params.keyboard)).toEqual({
            inline: true,
            buttons: [
                [{action: {type: 'callback', label: 'Yes', payload: '{"command":"answered","args":{"id":1}}'}}],
                [{action: {type: 'open_link', label: 'Site', link: 'https://s'}}, {action: {type: 'text', label: 'Plain'}}],
            ],
        });
        expect(sent.providerId).toBe('4242');
        expect(sent.type).toBe(MultiBotMessageType.Message);
        expect(storage.messages).toHaveLength(1);
    });

    test("a blocked-code refusal reports the block and re-throws; other codes only re-throw", async () => {
        const {bot, api, provider} = setup();
        const blocked = vi.fn(async () => {
        });
        bot.onBlocked(blocked);
        const chat = await chatOf(bot, provider);

        vi.mocked(api.call).mockRejectedValueOnce(new VkApiError({error_code: 901, error_msg: "Can't send messages for users without permission"}));
        await expect(chat.sendMessage('x')).rejects.toBeInstanceOf(VkApiError);
        expect(blocked).toHaveBeenCalledWith(expect.objectContaining({id: chat.id}), true);

        blocked.mockClear();
        vi.mocked(api.call).mockRejectedValueOnce(new VkApiError({error_code: 100, error_msg: 'One of the parameters is invalid'}));
        await expect(chat.sendMessage('x')).rejects.toThrow(/invalid/);
        expect(blocked).not.toHaveBeenCalled();

        await chat.sendMessage('ok');
        expect(blocked).toHaveBeenLastCalledWith(expect.objectContaining({id: chat.id}), false);
    });

    test("setTypingStatus addresses the peer's user id; editMessage is explicitly unsupported", async () => {
        const {bot, provider, calls} = setup();
        const chat = await chatOf(bot, provider);
        await chat.setTypingStatus();
        expect(calls).toContainEqual(['messages.setActivity', {user_id: '300', type: 'typing'}]);
        await expect(chat.editMessage(new MultiBotMessage(), 'x')).rejects.toThrow(/not implemented/);
    });
});

describe("VkApiError", () => {
    test("isBlocked for 7/15/901/902 only", () => {
        for (const code of [7, 15, 901, 902]) {
            expect(new VkApiError({error_code: code, error_msg: 'x'}).isBlocked).toBe(true);
        }
        expect(new VkApiError({error_code: 100, error_msg: 'x'}).isBlocked).toBe(false);
    });
});
