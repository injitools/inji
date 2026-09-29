import got from "got";
import FormData from "form-data";
import * as fs from "node:fs";
import {SocksProxyAgent} from "socks-proxy-agent";
import {redactError} from "@injitools/bot";

import {TelegramApiError} from "./TelegramApiError.js";
import type {
    IGetMeResponse,
    ISendInvoiceParams,
    ITelegramChat,
    ITelegramFile,
    ITelegramGetUpdatesResultItem,
    ITelegramResponse,
    TTelegramReplyMarkup,
    UpdatesType,
} from "./types.js";

export interface TelegramApiOptions {
    /**
     * `socks5h://user:pass@host:port` (socks5h — DNS through the proxy too) to reach api.telegram.org
     * where it is blocked. Default: `process.env.TELEGRAM_PROXY_URL`, read lazily on the first
     * request (so the client can be constructed before .env is loaded). `false` disables the env
     * lookup.
     */
    proxyUrl?: string | false;
    /** Default: https://api.telegram.org */
    baseUrl?: string;
}

type GotAgent = {https: SocksProxyAgent};

/** A thin Bot API client: every method is one HTTP call, errors carry the API's error_code. */
export default class TelegramApi {
    private agent: GotAgent | false | undefined;
    private readonly baseUrl: string;
    private readonly proxyUrl: string | false | undefined;

    constructor(private token: string, options: TelegramApiOptions = {}) {
        this.baseUrl = (options.baseUrl ?? 'https://api.telegram.org').replace(/\/$/, '');
        this.proxyUrl = options.proxyUrl;
    }

    private url(command: string) {
        return `${this.baseUrl}/bot${this.token}/${command}`;
    }

    private proxyAgent(): GotAgent | undefined {
        if (this.agent === undefined) {
            const url = this.proxyUrl === undefined ? process.env.TELEGRAM_PROXY_URL : this.proxyUrl;
            this.agent = url ? {https: new SocksProxyAgent(url)} : false;
        }
        return this.agent || undefined;
    }

    /**
     * What a failed request is thrown as. The token is in every request URL, so the got error is
     * never let out as is (see redactError): a refusal becomes a TelegramApiError from the API's
     * own body — without it the error_code would be lost behind "Response code 403" — and
     * anything else (network failure, a proxy answering with HTML) is rebuilt with the token
     * masked; an HTTP status, if any, is kept as the TelegramApiError code.
     */
    private requestError(e: any): Error {
        const body = e?.response?.body;
        const status: number | undefined = e?.response?.statusCode;
        if (body?.description) {
            return new TelegramApiError(body.description, body.error_code ?? status, body);
        }
        const redacted = redactError(e, [this.token]);
        return status === undefined ? redacted : new TelegramApiError(redacted.message, status);
    }

    async getCommand<T>(command: string, searchParams?: any): Promise<T> {
        let result: ITelegramResponse<T>;
        try {
            result = await got.get<ITelegramResponse<T>>(this.url(command), {
                resolveBodyOnly: true,
                responseType: 'json',
                searchParams,
                agent: this.proxyAgent(),
            });
        } catch (e) {
            throw this.requestError(e);
        }
        if (!result.ok) {
            throw new TelegramApiError(result.description, result.error_code, result);
        }
        return result.result;
    }

    async postCommand<T = any>(command: string, json: any, formData = false): Promise<T> {
        let result: ITelegramResponse<T>;
        try {
            result = await got.post<ITelegramResponse<T>>(this.url(command), {
                resolveBodyOnly: true,
                responseType: 'json',
                [formData ? 'body' : 'json']: json,
                headers: formData ? json.getHeaders() : undefined,
                agent: this.proxyAgent(),
            });
        } catch (e) {
            throw this.requestError(e);
        }
        if (!result.ok) {
            throw new TelegramApiError(result.description, result.error_code, result);
        }
        return result.result;
    }

    // ── Updates ──────────────────────────────────────────────────────────────────

    /** `timeout` is in SECONDS (long polling). */
    getUpdates(params?: {offset?: number, limit?: number, timeout?: number, allowed_updates?: UpdatesType[]}) {
        return this.getCommand<ITelegramGetUpdatesResultItem[]>('getUpdates', params);
    }

    // ── Messages ─────────────────────────────────────────────────────────────────

    sendMessage(chat_id: number | string, text: string, parse_mode?: string | false, reply_markup?: TTelegramReplyMarkup, extra: Record<string, any> = {}) {
        return this.postCommand<{message_id: number}>('sendMessage', {
            chat_id,
            text,
            parse_mode: parse_mode === false ? undefined : (parse_mode || 'Markdown'),
            reply_markup,
            disable_web_page_preview: true,
            ...extra,
        });
    }

    sendPhoto(chat_id: number | string, photoPath: string, caption: string, parse_mode?: string | false, reply_markup?: TTelegramReplyMarkup) {
        const formData = new FormData();
        formData.append('chat_id', chat_id);
        formData.append('caption', caption);
        if (parse_mode !== false) {
            formData.append('parse_mode', parse_mode || 'Markdown');
        }
        if (reply_markup) {
            formData.append('reply_markup', JSON.stringify(reply_markup));
        }
        formData.append('disable_web_page_preview', 1);
        formData.append('photo', fs.createReadStream(photoPath));
        return this.postCommand<{message_id: number}>('sendPhoto', formData, true);
    }

    /** Edits in place; "message is not modified" is not an error here. */
    async editMessageText(chat_id: number | string, message_id: number | string, text: string, parse_mode?: string | false, reply_markup?: TTelegramReplyMarkup) {
        try {
            await this.postCommand("editMessageText", {
                chat_id,
                message_id,
                text,
                parse_mode: parse_mode === false ? undefined : (parse_mode || 'Markdown'),
                reply_markup,
                disable_web_page_preview: true,
            });
        } catch (e) {
            if (!e.message?.includes('message is not modified')) {
                throw e;
            }
        }
    }

    deleteMessage(chat_id: number | string, message_id: number) {
        return this.postCommand("deleteMessage", {chat_id, message_id});
    }

    sendChatAction(chat_id: number | string, action: string) {
        return this.postCommand("sendChatAction", {chat_id, action});
    }

    answerCallbackQuery(callback_query_id: string, params: {text?: string, show_alert?: boolean, url?: string, cache_time?: number} = {}) {
        return this.postCommand("answerCallbackQuery", {callback_query_id, ...params});
    }

    // ── Payments ─────────────────────────────────────────────────────────────────

    sendInvoice(params: ISendInvoiceParams) {
        return this.postCommand('sendInvoice', params);
    }

    answerPreCheckoutQuery(id: string, ok: boolean, error_message?: string) {
        return this.postCommand("answerPreCheckoutQuery", {pre_checkout_query_id: id, ok, error_message});
    }

    // ── Bot / chat / files ───────────────────────────────────────────────────────

    getMe() {
        return this.getCommand<IGetMeResponse>('getMe');
    }

    /**
     * A private chat's profile: name, username, photo. Privacy settings cannot hide these once
     * the peer has started a dialog with the bot; only bio and photo can be hidden.
     */
    getChat(chat_id: number | string) {
        return this.getCommand<ITelegramChat>('getChat', {chat_id});
    }

    /** File metadata (file_path) for download — the link itself lives about an hour. */
    getFile(file_id: string) {
        return this.getCommand<ITelegramFile>('getFile', {file_id});
    }

    /** File content by the file_path from getFile. */
    async downloadFile(file_path: string): Promise<Buffer> {
        try {
            return await got.get(`${this.baseUrl}/file/bot${this.token}/${file_path}`, {
                responseType: 'buffer',
                resolveBodyOnly: true,
                agent: this.proxyAgent(),
            });
        } catch (e) {
            throw this.requestError(e);
        }
    }
}
