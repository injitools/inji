// @injitools/bot — the messenger-agnostic chat-bot core for Inji.
//
// The main entry has NO messenger and NO database dependency. Plug in:
//   - a social provider per messenger: `@injitools/bot-telegram`, `@injitools/bot-vk`, or your own
//     IMultiBotSocialProvider;
//   - a storage: `@injitools/bot/typeorm` (entities included), or your own IMultiBotStorageProvider.

// ── The bot ──────────────────────────────────────────────────────────────────────
export {default as MultiBot, parseCommandText} from "./MultiBot.js";
export type {
    MultiBotOptions,
    MultiBotLogger,
    MultiBotMessageHandler,
    MultiBotCommandHandler,
    MultiBotInputHandler,
    MultiBotBlockedHandler,
    IncomingEvent,
    ParsedIncoming,
} from "./MultiBot.js";

// ── Chat / message / template ────────────────────────────────────────────────────
export {default as MultiBotChat, WAIT_INPUT_OPTION} from "./MultiBotChat.js";
export {default as MultiBotMessage} from "./MultiBotMessage.js";
export type {MultiBotCommandPayload} from "./MultiBotMessage.js";
export {MultiBotMessageType} from "./MultiBotMessageType.js";
export {default as MultiBotProviderEvent} from "./MultiBotProviderEvent.js";
export {default as MultiBotMessageTemplate, EntityType, toTemplate} from "./MultiBotMessageTemplate.js";
export type {TemplateInput, TemplateEntity, TemplateAttachment, TemplateFormat} from "./MultiBotMessageTemplate.js";

// ── Keyboards ────────────────────────────────────────────────────────────────────
export {default as MultiBotKeyboardBuilder} from "./keyboard/MultiBotKeyboardBuilder.js";
export {default as MultiBotKeyboardLine} from "./keyboard/MultiBotKeyboardLine.js";
export {default as MultiBotKeyboardButton, ButtonType} from "./keyboard/MultiBotKeyboardButton.js";

// ── Provider contracts ───────────────────────────────────────────────────────────
export type {default as IMultiBotSocialProvider} from "./interfaces/IMultiBotSocialProvider.js";
export type {default as IMultiBotStorageProvider} from "./interfaces/IMultiBotStorageProvider.js";
export {redactError} from "./redactError.js";
export type {RedactedError} from "./redactError.js";

// ── Reference storage (tests / prototypes; nothing persists) ─────────────────────
export {default as MultiBotMemoryStorage} from "./storage/MultiBotMemoryStorage.js";
