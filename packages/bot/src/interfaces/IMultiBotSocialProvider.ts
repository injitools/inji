import type MultiBot from "../MultiBot.js";
import type MultiBotMessage from "../MultiBotMessage.js";
import type MultiBotChat from "../MultiBotChat.js";

/**
 * A messenger adapter. `@injitools/bot-telegram` and `@injitools/bot-vk` ship one each; the
 * contract is small enough to implement for another messenger:
 *
 *  - `name` is the provider's identity in storage and in peers (`telegram:bot:<id>`);
 *  - `pullUpdates()` fetches one batch of updates and feeds each into `bot.ingest(...)`;
 *  - `sendMessage`/`editMessage`/`setTypingStatus` render a MultiBotMessage in the messenger's markup.
 */
export default interface IMultiBotSocialProvider {
    /** Template formats the provider can render, best first (see MultiBotMessageTemplate.build). */
    msgFormats: string[];
    name: string;
    /** Set by MultiBot.addProvider. */
    bot: MultiBot;

    pullUpdates(): Promise<void>;

    sendMessage(message: MultiBotMessage): Promise<MultiBotMessage>;

    editMessage(message: MultiBotMessage, text: string): Promise<MultiBotMessage>;

    setTypingStatus(chat: MultiBotChat): Promise<any>;
}
