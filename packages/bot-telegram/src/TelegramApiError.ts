/**
 * A Bot API refusal with its error_code kept: the text alone cannot tell a blocked bot (403)
 * from a markup typo (400), and block detection needs the code. `message` is the API's
 * `description`.
 */
export class TelegramApiError extends Error {
    constructor(
        message: string,
        public code?: number,
        public body?: any) {
        super(message);
        this.name = 'TelegramApiError';
    }

    /** The peer blocked the bot, deleted the account or the chat is gone — sending is pointless. */
    get isBlocked(): boolean {
        // 403 from the Bot API always means "cannot deliver", with varying texts: blocked the bot,
        // stopped it, deactivated the account. 400 "chat not found" — the chat no longer exists.
        return this.code === 403 || /bot was blocked|user is deactivated|bot was kicked|chat not found/i.test(this.message);
    }
}
