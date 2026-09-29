// @injitools/bot-vk — VK for @injitools/bot.

// ── The provider ─────────────────────────────────────────────────────────────────
export {default as MultiBotVkProvider} from "./MultiBotVkProvider.js";
export type {VkProviderOptions} from "./MultiBotVkProvider.js";

// ── API client ───────────────────────────────────────────────────────────────────
export {default as VkApi} from "./VkApi.js";
export type {VkApiOptions} from "./VkApi.js";
export {default as VkApiError, VK_BLOCKED_CODES} from "./VkApiError.js";

// ── Types ────────────────────────────────────────────────────────────────────────
export {VkApiEvent, VkApiUserType} from "./types.js";
export type {
    TVkApiResponse,
    TVkApiResponseError,
    TVkApiLongPollServer,
    TVkApiLongPollResponse,
    TVkApiButtonActions,
    TVkApiClientInfo,
    TVkApiMessage,
    TVkApiEvent,
    TVkApiEvents,
    IVkApiEventMessageNew,
    IVkApiEventMessageEvent,
    IVkApiEventMessageAllow,
    IVkApiEventMessageDeny,
    VkUser,
    VkConversation,
    VkPhoto,
    VkPhotoSize,
    VkMessage,
    VkSenderContext,
} from "./types.js";
