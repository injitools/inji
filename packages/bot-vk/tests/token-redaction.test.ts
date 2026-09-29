import {describe, test, expect, beforeAll, afterAll} from "vitest";
import http from "node:http";
import type {AddressInfo} from "node:net";
import {inspect} from "node:util";

import {VkApi, VkApiError} from "@injitools/bot-vk";

// The community token rides in the form and the Long Poll key in the URL; got keeps both on its
// error object, so console.error(e) of a raw got error would print them.
const TOKEN = 'vk1.a.SECRET-token';
const KEY = 'SECRET-longpoll-key';

function leaked(e: unknown) {
    const err = e as Error;
    return `${err.message}\n${err.stack}\n${inspect(e, {depth: 8})}`.includes('SECRET');
}

let server: http.Server;
let base: string;

beforeAll(async () => {
    server = http.createServer((req, res) => {
        req.resume();
        req.on('end', () => {
            if (req.url!.startsWith('/html')) {
                res.writeHead(502, {'content-type': 'text/html'});
                res.end('<html>bad gateway</html>');
            } else {
                res.writeHead(200, {'content-type': 'application/json'});
                res.end(JSON.stringify({error: {error_code: 5, error_msg: 'User authorization failed', request_params: []}}));
            }
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

async function failure(run: () => Promise<unknown>) {
    return run().then(() => { throw new Error('expected a failure'); }, e => e);
}

describe('VkApi errors do not carry the token', () => {
    test('an API refusal stays a VkApiError with its code', async () => {
        const e = await failure(() => new VkApi(TOKEN, {apiUrl: `${base}/`}).call('users.get'));
        expect(e).toBeInstanceOf(VkApiError);
        expect(e.code).toBe(5);
        expect(leaked(e)).toBe(false);
    });

    test('an HTTP failure keeps the status, not the form', async () => {
        const e = await failure(() => new VkApi(TOKEN, {apiUrl: `${base}/html/`}).call('users.get'));
        expect(e.statusCode).toBe(502);
        expect(leaked(e)).toBe(false);
    });

    test('a network failure keeps its code, not the form', async () => {
        const e = await failure(() => new VkApi(TOKEN, {apiUrl: 'http://127.0.0.1:1/'}).call('users.get'));
        expect(e.code).toBe('ECONNREFUSED');
        expect(leaked(e)).toBe(false);
    });

    test('a Long Poll failure does not print the session key', async () => {
        const e = await failure(() => new VkApi(TOKEN).longPoll(`${base}/html`, KEY, '1', 1));
        expect(e.statusCode).toBe(502);
        expect(e.message).toContain('<redacted>');
        expect(leaked(e)).toBe(false);
    });
});
