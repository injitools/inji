import {describe, test, expect} from "vitest";

import {autoFixTelegramMarkdownV2, ensureMarkdownV2, escapeMarkdownV2, validateTelegramMarkdownV2} from "@injitools/bot-telegram";

describe("validateTelegramMarkdownV2", () => {
    test("accepts plain text and balanced markup", () => {
        expect(validateTelegramMarkdownV2('Привет мир').valid).toBe(true);
        expect(validateTelegramMarkdownV2('*bold* _italic_ __under__ ~strike~ `code` ```pre```').valid).toBe(true);
        expect(validateTelegramMarkdownV2('[link](https://x)').valid).toBe(true);
        expect(validateTelegramMarkdownV2('escaped \\. and \\!').valid).toBe(true);
    });

    test("rejects unescaped reserved characters", () => {
        expect(validateTelegramMarkdownV2('Hello.').valid).toBe(false);
        expect(validateTelegramMarkdownV2('Hello!').valid).toBe(false);
        expect(validateTelegramMarkdownV2('a - b').valid).toBe(false);
    });

    test("rejects unclosed and mismatched entities", () => {
        expect(validateTelegramMarkdownV2('*bold').valid).toBe(false);
        expect(validateTelegramMarkdownV2('text]').valid).toBe(false);
        expect(validateTelegramMarkdownV2('`unclosed code').valid).toBe(false);
    });

    test("reserved characters inside code are fine", () => {
        expect(validateTelegramMarkdownV2('`a.b-c!`').valid).toBe(true);
        expect(validateTelegramMarkdownV2('```\nx = 1.5;\n```').valid).toBe(true);
    });
});

describe("autoFixTelegramMarkdownV2", () => {
    test("escapes reserved punctuation in prose", () => {
        expect(autoFixTelegramMarkdownV2('Hello, world. Call +7 (999) 1-2!')).toBe('Hello, world\\. Call \\+7 \\(999\\) 1\\-2\\!');
    });

    test("keeps balanced markup and escaped characters as is", () => {
        expect(autoFixTelegramMarkdownV2('*bold* and \\. and `a.b`')).toBe('*bold* and \\. and `a.b`');
    });

    test("escapes the opening markup of an unclosed entity", () => {
        expect(autoFixTelegramMarkdownV2('5*3 = 15')).toBe('5\\*3 \\= 15');
        expect(autoFixTelegramMarkdownV2('a __b')).toBe('a \\_\\_b');
    });

    test("escapes a stray closing bracket", () => {
        expect(autoFixTelegramMarkdownV2('x] y')).toBe('x\\] y');
    });

    test("the result passes the validator", () => {
        for (const s of ['Hello.', '5*3', 'a __b', 'x] y', '![', 'a ``` b ` c', 'link [text](http://a.b/c?d=1)']) {
            const fixed = autoFixTelegramMarkdownV2(s);
            expect(validateTelegramMarkdownV2(fixed), `${JSON.stringify(s)} → ${JSON.stringify(fixed)}`).toMatchObject({valid: true});
        }
    });
});

describe("ensureMarkdownV2 / escapeMarkdownV2", () => {
    test("ensure returns valid text untouched and fixes invalid text", () => {
        expect(ensureMarkdownV2('*ok*')).toBe('*ok*');
        expect(ensureMarkdownV2('no.')).toBe('no\\.');
    });

    test("escape neutralizes every reserved character", () => {
        const s = '_*[]()~`>#+-=|{}.!\\';
        expect(validateTelegramMarkdownV2(escapeMarkdownV2(s)).valid).toBe(true);
        expect(escapeMarkdownV2('a.b')).toBe('a\\.b');
    });
});
