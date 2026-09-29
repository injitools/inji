import "reflect-metadata";
import {describe, test, expect} from "vitest";
import type {EntityManager} from "typeorm";

import {MultiBotChat, MultiBotMessage, MultiBotMessageType, MultiBotProviderEvent} from "@injitools/bot";
import {
    MultiBotChatOptionOrm,
    MultiBotChatMessageOrm,
    MultiBotTypeOrmProvider,
    multiBotEntities,
} from "@injitools/bot/typeorm";
import {FakeManager} from "./fake-manager.js";

function setup() {
    const manager = new FakeManager();
    const storage = new MultiBotTypeOrmProvider(manager as unknown as EntityManager);
    return {manager, storage};
}

describe("MultiBotTypeOrmProvider", () => {
    test("exposes its entities for the DataSource", () => {
        expect(MultiBotTypeOrmProvider.entities).toBe(multiBotEntities);
        expect(multiBotEntities).toHaveLength(5);
    });

    test("chat options: each JS type survives the string column, booleans included", async () => {
        const {storage, manager} = setup();
        await storage.updateChatOption(1, 'flag', true);
        await storage.updateChatOption(1, 'off', false);
        await storage.updateChatOption(1, 'n', 42);
        await storage.updateChatOption(1, 'o', {a: [1]});
        await storage.updateChatOption(1, 's', 'text');

        expect(await storage.getChatOption(1, 'flag')).toBe(true);
        expect(await storage.getChatOption(1, 'off')).toBe(false);
        expect(await storage.getChatOption(1, 'n')).toBe(42);
        expect(await storage.getChatOption(1, 'o')).toEqual({a: [1]});
        expect(await storage.getChatOption(1, 's')).toBe('text');
        expect(await storage.getChatOption(1, 'missing')).toBeUndefined();

        // what is actually in the column
        const rows = manager.dump(MultiBotChatOptionOrm);
        expect(rows.find(r => r.param === 'flag')).toMatchObject({type: 'boolean', value: 'true'});
        expect(rows.find(r => r.param === 'o')).toMatchObject({type: 'object', value: '{"a":[1]}'});
    });

    test("chat options: a boolean row written as '1'/'0' by older code still reads back", async () => {
        const {storage, manager} = setup();
        await manager.upsert(MultiBotChatOptionOrm, {chatId: 1, param: 'legacy', type: 'boolean', value: '1'}, ['chatId', 'param']);
        expect(await storage.getChatOption(1, 'legacy')).toBe(true);
    });

    test("chat option upsert overwrites, keyed by (chatId, param)", async () => {
        const {storage, manager} = setup();
        await storage.updateChatOption(1, 'k', 'a');
        await storage.updateChatOption(1, 'k', 'b');
        await storage.updateChatOption(2, 'k', 'c');
        expect(manager.dump(MultiBotChatOptionOrm)).toHaveLength(2);
        expect(await storage.getChatOption(1, 'k')).toBe('b');
    });

    test("provider options round-trip (json column)", async () => {
        const {storage} = setup();
        await storage.updateProviderOption('tg', 'lastUpdate', 10);
        await storage.updateProviderOption('tg', 'lastUpdate', 11);
        await storage.updateProviderOption('vk', 'server', {key: 'k', ts: '1'});
        expect(await storage.getProviderOption('tg', 'lastUpdate')).toBe(11);
        expect(await storage.getProviderOption('vk', 'server')).toEqual({key: 'k', ts: '1'});
        expect(await storage.getProviderOption('tg', 'nope')).toBeUndefined();
    });

    test("provider events: upsert by (provider, eventId), read back as MultiBotProviderEvent", async () => {
        const {storage} = setup();
        const e = new MultiBotProviderEvent();
        e.provider = 'tg';
        e.eventId = '5';
        e.type = '';
        e.date = new Date(0);
        e.data = {update_id: 5};
        e.executed = false;
        await storage.saveProviderEvent(e);
        e.executed = true;
        await storage.saveProviderEvent(e);

        const loaded = await storage.getProviderEvent('tg', '5');
        expect(loaded).toBeInstanceOf(MultiBotProviderEvent);
        expect(loaded).toMatchObject({provider: 'tg', eventId: '5', executed: true, data: {update_id: 5}});
        expect(await storage.getProviderEvent('tg', '6')).toBeUndefined();
    });

    test("chats: getChatByPeers creates once, getChatById/getChatByProviderId find, saveChat updates", async () => {
        const {storage} = setup();
        const a = await storage.getChatByPeers('tg', 'telegram:user:1');
        const b = await storage.getChatByPeers('tg', 'telegram:user:1');
        expect(a.id).toBe(b.id);
        expect(a).toBeInstanceOf(MultiBotChat);
        expect(a.providerName).toBe('tg');

        a.providerId = 'tg:100';
        await storage.saveChat(a);
        expect((await storage.getChatByProviderId('tg', 'tg:100')).id).toBe(a.id);
        expect((await storage.getChatById(a.id)).providerId).toBe('tg:100');
        expect(await storage.getChatById(99)).toBeUndefined();
        expect(await storage.getChatByProviderId('tg', 'nope')).toBeUndefined();

        const fresh = new MultiBotChat();
        fresh.providerName = 'tg';
        fresh.peer = 'telegram:user:2';
        fresh.providerId = 'tg:200';
        await storage.saveChat(fresh);
        expect(fresh.id).toBeGreaterThan(a.id);
    });

    test("messages: insert sets id; the same (chat, providerId) updates instead of duplicating", async () => {
        const {storage, manager} = setup();
        const chat = await storage.getChatByPeers('tg', 'telegram:user:1');

        const m = new MultiBotMessage();
        m.chat = chat;
        m.from = 'telegram:user:1';
        m.to = 'tg';
        m.providerId = '77';
        m.type = MultiBotMessageType.Message;
        m.text = 'hi';
        m.date = new Date(0);
        m.context = {language: 'ru'};
        await storage.saveMessage(m);
        expect(m.id).toBe(1);

        const again = new MultiBotMessage();
        Object.assign(again, m, {id: undefined, text: 'edited'});
        await storage.saveMessage(again);
        expect(again.id).toBe(1);
        expect(manager.dump(MultiBotChatMessageOrm)).toHaveLength(1);
        expect(manager.dump(MultiBotChatMessageOrm)[0]).toMatchObject({chatId: chat.id, text: 'edited', context: {language: 'ru'}});
    });
});
