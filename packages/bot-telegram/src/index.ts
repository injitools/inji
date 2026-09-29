// @injitools/bot-telegram — Telegram for @injitools/bot.

// ── The provider ─────────────────────────────────────────────────────────────────
export {default as MultiBotTelegramProvider} from "./MultiBotTelegramProvider.js";
export type {TelegramProviderOptions} from "./MultiBotTelegramProvider.js";

// ── Bot API client ───────────────────────────────────────────────────────────────
export {default as TelegramApi} from "./TelegramApi.js";
export type {TelegramApiOptions} from "./TelegramApi.js";
export {TelegramApiError} from "./TelegramApiError.js";

// ── MarkdownV2 ───────────────────────────────────────────────────────────────────
export {validateTelegramMarkdownV2, autoFixTelegramMarkdownV2, ensureMarkdownV2, escapeMarkdownV2} from "./markdownV2.js";

// ── Types ────────────────────────────────────────────────────────────────────────
export {UpdatesType, TelegramApiUserType} from "./types.js";
export type {
    ITelegramResponse,
    IGetMeResponse,
    ITelegramUser,
    ITelegramChat,
    ITelegramFile,
    ISendInvoiceParams,
    ITelegramMessage,
    ITelegramPreCheckoutQuery,
    ITelegramPreCheckoutQueryOrderInfo,
    ITelegramCallbackQuery,
    ITelegramGetUpdatesResultItem,
    TTelegramKeyboardButton,
    TTelegramKeyboard,
    TTelegramReplyMarkup,
    TelegramSenderContext,
} from "./types.js";
