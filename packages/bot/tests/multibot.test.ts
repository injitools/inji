import {describe, test, expect, vi} from "vitest";

import {
    MultiBot,
    MultiBotChat,
    MultiBotMemoryStorage,
    MultiBotMessage,
    MultiBotMessageType,
    parseCommandText,
    type IMultiBotSocialProvider,
    type ParsedIncoming,
} from "@injitools/bot";

/** A provider that records what it was asked to send instead of talking to a messenger. */
class FakeProvider implements IMultiBotSocialProvider {
    msgFormats = ['text'];
    bot: MultiBot;
    sent: MultiBotMessage[] = [];

    constructor(public name = 'fake:bot:1') {
    }

    async pullUpdates() {
    }

    async sendMessage(message: MultiBotMessage) {
        this.sent.push(message);
        return message;
    }

    async editMessage(message: MultiBotMessage, text: string) {
        message.text = text;
        return message;
    }

    async setTypingStatus() {
    }
}

function setup() {
    const storage = new MultiBotMemoryStorage();
    const logger = {error: vi.fn(), warn: vi.fn()};
    const bot = new MultiBot(storage, {logger});
    const provider = new FakeProvider();
    bot.addProvider(provider);
    return {bot, storage, provider, logger};
}

const incoming = (eventId: string, parsed: Partial<ParsedIncoming>): [{eventId: string, data: any}, () => ParsedIncoming] => [
    {eventId, data: {raw: eventId}},
    () => ({providerId: `m${eventId}`, from: 'fake:user:42', ...parsed}),
];

describe("parseCommandText", () => {
    test("splits /command and args, ignores extra spaces", () => {
        expect(parseCommandText('/start')).toEqual({command: 'start', args: []});
        expect(parseCommandText('/set_phone  +7 999')).toEqual({command: 'set_phone', args: ['+7', '999']});
    });

    test("returns null for plain text and empty input", () => {
        expect(parseCommandText('hello /start')).toBeNull();
        expect(parseCommandText('')).toBeNull();
        expect(parseCommandText(null)).toBeNull();
    });
});

describe("MultiBot.ingest", () => {
    test("stores the raw event, creates the chat by peer, stores the message and dispatches a text message", async () => {
        const {bot, storage, provider} = setup();
        const seen: MultiBotMessage[] = [];
        bot.message('*', async (m) => {
            seen.push(m);
        });

        const message = await bot.ingest(provider, ...incoming('1', {text: 'hello'}));

        expect(message.type).toBe(MultiBotMessageType.Message);
        expect(seen).toHaveLength(1);
        expect(seen[0].chat.peer).toBe('fake:user:42');
        expect(seen[0].chat.provider).toBe(provider);
        expect(seen[0].chat.bot).toBe(bot);
        expect(storage.messages).toHaveLength(1);
        const event = await storage.getProviderEvent(provider.name, '1');
        expect(event.executed).toBe(true);
        expect(event.data).toEqual({raw: '1'});
    });

    test("routes an exact text to its handler, everything else to '*', case- and space-insensitively", async () => {
        const {bot, provider} = setup();
        const hits: string[] = [];
        bot.message('статус', async () => {
            hits.push('status');
        });
        bot.message('*', async () => {
            hits.push('any');
        });
        await bot.ingest(provider, ...incoming('1', {text: '  Статус '}));
        await bot.ingest(provider, ...incoming('2', {text: 'something else'}));
        expect(hits).toEqual(['status', 'any']);
    });

    test("parses /command text into a command and dispatches it with its args", async () => {
        const {bot, provider} = setup();
        const calls: [string, any][] = [];
        bot.command('start', async (cmd, m) => {
            calls.push([cmd, m.payload.args]);
        });
        const message = await bot.ingest(provider, ...incoming('1', {text: '/start ref123'}));
        expect(message.type).toBe(MultiBotMessageType.Command);
        expect(calls).toEqual([['start', ['ref123']]]);
    });

    test("an explicit payload (callback button) wins over the text", async () => {
        const {bot, provider} = setup();
        const calls: string[] = [];
        bot.command('answered', async (cmd) => {
            calls.push(cmd);
        });
        await bot.ingest(provider, ...incoming('1', {text: '/start', payload: {command: 'answered', args: {id: 7}}}));
        expect(calls).toEqual(['answered']);
    });

    test("an unknown command is logged, not thrown, and the event is marked executed", async () => {
        const {bot, provider, storage, logger} = setup();
        await bot.ingest(provider, ...incoming('1', {text: '/nope'}));
        expect(logger.error).toHaveBeenCalledWith('MultiBot: unknown command', 'nope');
        expect((await storage.getProviderEvent(provider.name, '1')).executed).toBe(true);
    });

    test("a re-delivered event is skipped once executed", async () => {
        const {bot, provider} = setup();
        const handler = vi.fn(async () => {
        });
        bot.message('*', handler);
        await bot.ingest(provider, ...incoming('1', {text: 'a'}));
        const again = await bot.ingest(provider, ...incoming('1', {text: 'a'}));
        expect(again).toBeUndefined();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test("a parser returning null marks the event handled with nothing dispatched", async () => {
        const {bot, provider, storage} = setup();
        const handler = vi.fn(async () => {
        });
        bot.message('*', handler);
        const result = await bot.ingest(provider, {eventId: '1', data: {}}, () => null);
        expect(result).toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect((await storage.getProviderEvent(provider.name, '1')).executed).toBe(true);
    });

    test("a throwing handler is logged and recorded on the event, which stays not executed; the next event still runs", async () => {
        const {bot, provider, storage, logger} = setup();
        const hits: string[] = [];
        bot.message('*', async (m) => {
            if (m.text === 'boom') throw new Error('handler failed');
            hits.push(m.text);
        });
        await bot.ingest(provider, ...incoming('1', {text: 'boom'}));
        await bot.ingest(provider, ...incoming('2', {text: 'ok'}));

        expect(logger.error).toHaveBeenCalledTimes(1);
        const failed = await storage.getProviderEvent(provider.name, '1');
        expect(failed.executed).toBe(false);
        expect(failed.error).toMatch(/^Error: handler failed/);
        expect(hits).toEqual(['ok']);
    });

    test("with chatProviderId the chat is keyed by it (a group), created once and reused", async () => {
        const {bot, provider, storage} = setup();
        bot.message('*', async () => {
        });
        const a = await bot.ingest(provider, ...incoming('1', {text: 'a', chatProviderId: 'fake:bot:1:-100'}));
        const b = await bot.ingest(provider, ...incoming('2', {text: 'b', chatProviderId: 'fake:bot:1:-100'}));
        expect(storage.chats).toHaveLength(1);
        expect(a.chat.id).toBe(b.chat.id);
        expect(a.chat.providerId).toBe('fake:bot:1:-100');
        expect(a.chat.peer).toBe('fake:user:42');
    });

    test("reports the peer as reachable on every incoming message (when a hook is set)", async () => {
        const {bot, provider} = setup();
        const blocked = vi.fn(async () => {
        });
        bot.onBlocked(blocked);
        bot.message('*', async () => {
        });
        const m = await bot.ingest(provider, ...incoming('1', {text: 'hi'}));
        expect(blocked).toHaveBeenCalledWith(m.chat, false);
    });
});

describe("dialog input", () => {
    test("requestInput routes the NEXT message to the input handler, then normal routing resumes", async () => {
        const {bot, provider} = setup();
        const log: string[] = [];
        bot.command('phone', async (_c, m) => {
            await m.requestInput('set_phone', 'Your number?');
        });
        bot.input('set_phone', async (input, m) => {
            log.push(`${input}=${m.text}`);
        });
        bot.message('*', async (m) => {
            log.push(`any:${m.text}`);
        });

        await bot.ingest(provider, ...incoming('1', {text: '/phone'}));
        expect(provider.sent).toHaveLength(1);
        expect(provider.sent[0].template.build()).toBe('Your number?');

        await bot.ingest(provider, ...incoming('2', {text: '+7 999'}));
        await bot.ingest(provider, ...incoming('3', {text: 'thanks'}));
        expect(log).toEqual(['set_phone=+7 999', 'any:thanks']);
    });

    test("an awaited input without a handler is logged", async () => {
        const {bot, provider, logger} = setup();
        bot.message('*', async (m) => {
            await m.chat.waitInput('missing');
        });
        await bot.ingest(provider, ...incoming('1', {text: 'a'}));
        await bot.ingest(provider, ...incoming('2', {text: 'b'}));
        expect(logger.error).toHaveBeenCalledWith('MultiBot: no handler for input', 'missing', 'b');
    });
});

describe("chats and answers", () => {
    test("answer/sendMessage build an outgoing message addressed from the provider to the peer", async () => {
        const {bot, provider} = setup();
        bot.message('*', async (m) => {
            await m.answer(t => t.text('Hi', 'bold').br().link('site', 'https://x'));
        });
        await bot.ingest(provider, ...incoming('1', {text: 'hey'}));
        const out = provider.sent[0];
        expect(out.from).toBe(provider.name);
        expect(out.to).toBe('fake:user:42');
        expect(out.type).toBe(MultiBotMessageType.Message);
        expect(out.template.build('text')).toBe('Hi \n site ( https://x )');
        expect(out.template.build('html')).toBe('<b>Hi</b> \n <a href="https://x">site</a>');
    });

    test("getChatById/getChatByPeers attach bot and provider to the loaded chat", async () => {
        const {bot, provider} = setup();
        const created = await bot.getChatByPeers(provider.name, 'fake:user:9');
        const loaded = await bot.getChatById(created.id);
        expect(loaded).toBeInstanceOf(MultiBotChat);
        expect(loaded.provider).toBe(provider);
        expect(loaded.bot).toBe(bot);
        expect(await bot.getChatById(999)).toBeUndefined();
    });

    test("chat options round-trip through the storage", async () => {
        const {bot, provider} = setup();
        const chat = await bot.getChatByPeers(provider.name, 'fake:user:9');
        await chat.setOption('inited', true);
        expect(await chat.getOption('inited')).toBe(true);
        expect(await chat.getOption('missing')).toBeUndefined();
    });
});
