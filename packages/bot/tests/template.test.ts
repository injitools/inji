import {describe, test, expect} from "vitest";

import {ButtonType, MultiBotKeyboardBuilder, MultiBotMessageTemplate, toTemplate} from "@injitools/bot";

describe("MultiBotMessageTemplate", () => {
    test("renders text, line breaks and links as plain text by default", () => {
        const t = new MultiBotMessageTemplate().text('Hello').br().text('world', 'bold').link('docs', 'https://d');
        expect(t.build()).toBe('Hello \n world docs ( https://d )');
        expect(t.build('MarkdownV2')).toBe(t.build('text'));
    });

    test("renders html with <b> and <a>", () => {
        const t = new MultiBotMessageTemplate().text('Hello').text('world', 'bold').link('docs', 'https://d');
        expect(t.build('html')).toBe('Hello <b>world</b> <a href="https://d">docs</a>');
    });

    test("keyboard(): callback form, an existing builder, inline flag, button kinds", () => {
        const t = new MultiBotMessageTemplate().keyboard(k => {
            k.inline();
            k.line().button('Yes').command('answered', {id: 1});
            const l = k.line();
            l.button('Site').link('https://s');
            l.button('Plain');
        });
        const kb = t.keyboardBuilder;
        expect(kb.isInline).toBe(true);
        expect(kb.lines).toHaveLength(2);
        expect(kb.lines[0].buttons[0]).toMatchObject({type: ButtonType.COMMAND, commandName: 'answered', commandArgs: {id: 1}});
        expect(kb.lines[1].buttons[0]).toMatchObject({type: ButtonType.LINK, url: 'https://s'});
        expect(kb.lines[1].buttons[1].type).toBe(ButtonType.SEND_MESSAGE);

        // a second callback extends the same builder
        t.keyboard(k => k.line().button('More'));
        expect(t.keyboardBuilder.lines).toHaveLength(3);

        const prebuilt = new MultiBotKeyboardBuilder();
        expect(new MultiBotMessageTemplate().keyboard(prebuilt).keyboardBuilder).toBe(prebuilt);
    });

    test("image() queues an attachment", () => {
        const t = new MultiBotMessageTemplate().image('cap', '/tmp/a.png');
        expect(t.attachments).toEqual([{type: 'image', caption: 'cap', path: '/tmp/a.png'}]);
    });

    test("toTemplate accepts a string, a template or a builder function", () => {
        expect(toTemplate('hi').build()).toBe('hi');
        const t = new MultiBotMessageTemplate();
        expect(toTemplate(t)).toBe(t);
        expect(toTemplate(b => b.text('x')).build()).toBe('x');
    });
});
