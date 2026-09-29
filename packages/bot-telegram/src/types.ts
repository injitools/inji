// Bot API shapes — only the fields the provider and typical bots read. See
// https://core.telegram.org/bots/api for the full objects.

export enum UpdatesType {
    message = "message",
    edited_channel_post = "edited_channel_post",
    callback_query = "callback_query",
}

export enum TelegramApiUserType {
    Bot = 'bot',
    User = 'user',
}

export interface ITelegramResponse<T> {
    ok: boolean;
    description?: string;
    error_code?: number;
    result: T;
}

export interface IGetMeResponse {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
}

export interface ITelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
}

/** getChat for a private chat (groups have other fields). */
export interface ITelegramChat {
    id: number;
    type: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    bio?: string;
    photo?: {
        small_file_id: string;
        small_file_unique_id: string;
        big_file_id: string;
        big_file_unique_id: string;
    };
}

export interface ITelegramFile {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    /** Download path; absent when the file is unavailable. */
    file_path?: string;
}

export interface ISendInvoiceParams {
    chat_id: number | string;
    message_thread_id?: number;
    title: string;
    description: string;
    payload: string;
    provider_token: string;
    currency: string;
    prices: {label: string, amount: number}[];
    max_tip_amount?: number;
    suggested_tip_amounts?: number[];
    start_parameter?: string;
    provider_data?: string;
    photo_url?: string;
    photo_size?: number;
    photo_width?: number;
    photo_height?: number;
    need_name?: boolean;
    need_phone_number?: boolean;
    need_email?: boolean;
    need_shipping_address?: boolean;
    send_phone_number_to_provider?: boolean;
    send_email_to_provider?: boolean;
    is_flexible?: boolean;
    disable_notification?: boolean;
    protect_content?: boolean;
    reply_to_message_id?: number;
    allow_sending_without_reply?: number;
    reply_markup?: any;
}

export interface ITelegramPreCheckoutQueryOrderInfo {
    email?: string;
}

export interface ITelegramMessage {
    message_id: number;
    message_thread_id?: number;
    from: ITelegramUser;
    chat: {id: number, first_name?: string, username?: string, type: string};
    date: number;
    text?: string;
    entities?: {offset: number, length: number, type: string}[];
    reply_to_message?: ITelegramMessage;
    successful_payment?: {
        currency: string;
        total_amount: number;
        invoice_payload: string;
        order_info: ITelegramPreCheckoutQueryOrderInfo;
        telegram_payment_charge_id: string;
        provider_payment_charge_id: string;
    };
}

export interface ITelegramPreCheckoutQuery {
    id: string;
    from: ITelegramUser;
    currency: string;
    total_amount: number;
    invoice_payload: string;
    order_info: ITelegramPreCheckoutQueryOrderInfo;
}

export interface ITelegramCallbackQuery {
    id: string;
    from: ITelegramUser;
    message: ITelegramMessage;
    chat_instance: string;
    data: string;
}

export interface ITelegramGetUpdatesResultItem {
    update_id: number;
    message?: ITelegramMessage;
    pre_checkout_query?: ITelegramPreCheckoutQuery;
    callback_query?: ITelegramCallbackQuery;
}

export type TTelegramKeyboardButton = {
    text: string;
    callback_data?: string;
    url?: string;
};

export type TTelegramKeyboard = TTelegramKeyboardButton[][];

export type TTelegramReplyMarkup = {
    inline_keyboard?: TTelegramKeyboard;
    keyboard?: TTelegramKeyboard;
    resize_keyboard?: boolean;
};

/** What the provider puts into `message.context` for an incoming message. */
export type TelegramSenderContext = {
    language?: string;
    first_name: string;
    username?: string;
    is_premium?: boolean;
};
