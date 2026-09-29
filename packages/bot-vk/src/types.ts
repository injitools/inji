// VK API shapes — only the fields the provider and typical bots read. See
// https://dev.vk.com/reference for the full objects.

export enum VkApiEvent {
    MessageNew = 'message_new',
    MessageEvent = 'message_event',
    // Community-message subscription: unlike Telegram, VK reports a block itself.
    MessageAllow = 'message_allow',
    MessageDeny = 'message_deny',
}

export enum VkApiUserType {
    Bot = 'bot',
    User = 'user',
}

export type TVkApiResponse<T = any> = {
    error?: TVkApiResponseError;
    response?: T;
};

export type TVkApiResponseError = {
    error_code: number;
    error_msg: string;
    request_params?: {key: string, value: string}[];
};

export type TVkApiLongPollServer = {
    key: string;
    server: string;
    ts: string;
};

export type TVkApiButtonActions =
    | "text"
    | "vkpay"
    | "open_app"
    | "location"
    | "open_link"
    | "open_photo"
    | "callback"
    | "intent_subscribe"
    | "intent_unsubscribe";

export type TVkApiClientInfo = {
    button_actions: TVkApiButtonActions[];
    keyboard: boolean;
    inline_keyboard: boolean;
    carousel: boolean;
    lang_id: number;
};

export type TVkApiMessage = {
    date: number;
    from_id: number;
    id: number;
    out: number;
    attachments: any[];
    conversation_message_id: number;
    fwd_messages: any[];
    important: boolean;
    is_hidden: boolean;
    peer_id: number;
    version?: number;
    random_id: number;
    text: string;
    payload?: string;
};

export type TVkApiLongPollResponse = {
    ts?: string;
    updates?: TVkApiEvents[];
    failed?: 1 | 2 | 3;
};

export type TVkApiEvent = {
    group_id: number;
    type: string;
    event_id: string;
    v: string;
    object: any;
};

export interface IVkApiEventMessageNew extends TVkApiEvent {
    type: "message_new";
    object: {
        message: TVkApiMessage;
        client_info: TVkApiClientInfo;
    };
}

export interface IVkApiEventMessageEvent extends TVkApiEvent {
    type: "message_event";
    object: {
        user_id: number;
        peer_id: number;
        event_id: string;
        payload: any;
        conversation_message_id: number;
    };
}

export interface IVkApiEventMessageAllow extends TVkApiEvent {
    type: "message_allow";
    object: {user_id: number, key: string};
}

/** The user forbade messages from the community — VK's equivalent of blocking the bot. */
export interface IVkApiEventMessageDeny extends TVkApiEvent {
    type: "message_deny";
    object: {user_id: number};
}

export type TVkApiEvents = IVkApiEventMessageNew | IVkApiEventMessageAllow | IVkApiEventMessageDeny | IVkApiEventMessageEvent;

export type VkUser = {
    id: number;
    first_name: string;
    last_name: string;
    screen_name?: string;
    photo_100?: string;
    /** 'deleted' | 'banned' for unavailable accounts; other fields may be missing then. */
    deactivated?: string;
};

export type VkConversation = {
    peer: {id: number, type: string, local_id: number};
    last_message_id: number;
    last_conversation_message_id: number;
    in_read: number;
    out_read: number;
    can_write: {allowed: boolean};
    is_marked_unread?: boolean;
    important?: boolean;
};

export type VkPhotoSize = {height: number, width: number, type: string, url: string};

export type VkPhoto = {
    album_id: number;
    date: number;
    id: number;
    owner_id: number;
    access_key?: string;
    sizes: VkPhotoSize[];
    text?: string;
    orig_photo?: VkPhotoSize;
};

export type VkMessage = TVkApiMessage & {
    attachments: {type: string, photo?: VkPhoto}[];
};

/** What the provider puts into `message.context` for an incoming message. */
export type VkSenderContext = {
    language?: string;
};
