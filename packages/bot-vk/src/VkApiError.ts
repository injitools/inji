import type {TVkApiResponseError} from "./types.js";

/** VK refusals meaning "this peer cannot be messaged": 901 — forbade messages from the community, 902 — closed DMs by privacy settings, 7/15 — access denied (incl. blacklist). */
export const VK_BLOCKED_CODES = [7, 15, 901, 902];

export default class VkApiError extends Error {
    constructor(public error: TVkApiResponseError) {
        super(error.error_msg);
        this.name = 'VkApiError';
    }

    get code(): number {
        return this.error?.error_code;
    }

    /** The peer cannot be messaged — see VK_BLOCKED_CODES. */
    get isBlocked(): boolean {
        return VK_BLOCKED_CODES.includes(this.code);
    }
}
