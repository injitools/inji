import got from "got";
import FormData from "form-data";
import * as fs from "node:fs";
import {redactError} from "@injitools/bot";

import VkApiError from "./VkApiError.js";
import type {TVkApiLongPollResponse, TVkApiResponse, VkConversation, VkMessage, VkUser} from "./types.js";

export interface VkApiOptions {
    /** Default: https://api.vk.com/method/ */
    apiUrl?: string;
    /** Default: 5.131 */
    apiVersion?: string;
}

/** A thin VK API client (community token): `call(method, params)` plus a few typed helpers. */
export default class VkApi {
    readonly apiUrl: string;
    readonly apiVersion: string;

    constructor(private token: string, options: VkApiOptions = {}) {
        this.apiUrl = options.apiUrl ?? 'https://api.vk.com/method/';
        this.apiVersion = options.apiVersion ?? '5.131';
    }

    async call<T = any>(method: string, form: Record<string, any> = {}): Promise<T> {
        let result: TVkApiResponse<T>;
        try {
            result = await got.post(this.apiUrl + method, {
                form: {...form, access_token: this.token, v: this.apiVersion},
            }).json<TVkApiResponse<T>>();
        } catch (e) {
            // The token rides in the form, and got keeps the form on its error — never let it out as is.
            throw redactError(e, [this.token]);
        }

        if (result.error) {
            throw new VkApiError(result.error);
        }
        return result.response;
    }

    /** Download a file by a direct VK URL (photo_100 and other CDN links need no token). */
    async download(url: string): Promise<Buffer> {
        return got.get(url, {responseType: 'buffer', resolveBodyOnly: true});
    }

    /** One Bots Long Poll request (`act=a_check`); `wait` in seconds. */
    async longPoll(server: string, key: string, ts: string, wait = 25) {
        try {
            return await got.get(server, {searchParams: {act: 'a_check', key, ts, wait}}).json<TVkApiLongPollResponse>();
        } catch (e) {
            // The session key is in the URL (and got 14 puts the URL into the message).
            throw redactError(e, [key, this.token]);
        }
    }

    /** Upload a photo to the messages upload server and return its `photo<owner>_<id>_<key>` attachment id. */
    async uploadMessagePhoto(peer_id: number | string, path: string): Promise<string> {
        const forUpload = await this.call<{upload_url: string}>('photos.getMessagesUploadServer', {peer_id});
        const formData = new FormData();
        formData.append('photo', fs.createReadStream(path));
        const uploaded = await got.post(forUpload.upload_url, {
            body: formData,
            headers: formData.getHeaders(),
        }).json<{server: string, photo: string, hash: string}>();
        const [photo] = await this.call<{id: number, owner_id: number, access_key: string}[]>('photos.saveMessagesPhoto', uploaded);
        return `photo${photo.owner_id}_${photo.id}_${photo.access_key}`;
    }

    messages = {
        getConversations: (params?: {offset?: number, count?: number, group_id?: number}) => {
            return this.call<{
                count: number;
                unread_count: number;
                items: {conversation: VkConversation, last_message: VkMessage}[];
            }>('messages.getConversations', params);
        },

        /** Whether the user allows messages from the community — VK answers directly, no probe send needed. */
        isMessagesFromGroupAllowed: (group_id: number, user_id: number) => {
            return this.call<{is_allowed: 0 | 1}>('messages.isMessagesFromGroupAllowed', {group_id, user_id});
        },
    };

    users = {
        /** User profiles. A group token suffices for the basic fields (name, screen name, photo). */
        get: (user_ids: number[], fields = 'photo_100,screen_name') => {
            return this.call<VkUser[]>('users.get', {user_ids: user_ids.join(','), fields});
        },
    };
}
