import {describe, test, expect, beforeAll, afterAll} from "vitest";
import http from "node:http";
import type {AddressInfo} from "node:net";
import {inspect} from "node:util";

import {TelegramApi, TelegramApiError} from "@injitools/bot-telegram";

// The token is in every Bot API URL, and got 14 puts the URL into its error message and keeps the
// whole request on the error object. A failed request must not carry the token out — neither in
// the text MultiBot stores for a failed update, nor in what console.error(e) prints.
const TOKEN = '123456:SECRET-token_value';

/** Everything a log line or a stored `error` column could end up with. */
function leaked(e: unknown) {
    const err = e as Error;
    return `${err.message}\n${err.stack}\n${inspect(e, {depth: 8})}`.includes('SECRET');
}

let server: http.Server;
let base: string;

beforeAll(async () => {
    server = http.createServer((req, res) => {
        if (req.url!.startsWith('/html')) {
            res.writeHead(502, {'content-type': 'text/html'});
            res.end('<html>bad gateway</html>');
        } else {
            res.writeHead(401, {'content-type': 'application/json'});
            res.end(JSON.stringify({ok: false, error_code: 401, description: 'Unauthorized'}));
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

async function failure(run: (api: TelegramApi) => Promise<unknown>, baseUrl: string) {
    const api = new TelegramApi(TOKEN, {baseUrl, proxyUrl: false});
    return run(api).then(() => { throw new Error('expected a failure'); }, e => e);
}

describe('TelegramApi errors do not carry the token', () => {
    test('an API refusal stays a TelegramApiError with its code', async () => {
        const e = await failure(api => api.getMe(), base);
        expect(e).toBeInstanceOf(TelegramApiError);
        expect(e.code).toBe(401);
        expect(leaked(e)).toBe(false);
    });

    test.each([
        ['getMe', (api: TelegramApi) => api.getMe()],
        ['sendMessage', (api: TelegramApi) => api.sendMessage(1, 'x')],
        ['downloadFile', (api: TelegramApi) => api.downloadFile('photos/1.jpg')],
    ])('%s: a non-JSON HTTP failure keeps the status, not the token', async (_name, run) => {
        const e = await failure(run, `${base}/html`);
        expect(e).toBeInstanceOf(TelegramApiError);
        expect(e.code).toBe(502);
        expect(e.message).toContain('<redacted>');
        expect(leaked(e)).toBe(false);
    });

    test.each([
        ['getMe', (api: TelegramApi) => api.getMe()],
        ['sendMessage', (api: TelegramApi) => api.sendMessage(1, 'x')],
    ])('%s: a network failure keeps its code, not the request', async (_name, run) => {
        const e = await failure(run, 'http://127.0.0.1:1');
        expect(e.code).toBe('ECONNREFUSED');
        expect(leaked(e)).toBe(false);
    });
});
