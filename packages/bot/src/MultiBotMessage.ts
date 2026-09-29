import type MultiBotChat from "./MultiBotChat.js";
import MultiBotMessageTemplate, {TemplateInput} from "./MultiBotMessageTemplate.js";
import type MultiBotProviderEvent from "./MultiBotProviderEvent.js";
import {MultiBotMessageType} from "./MultiBotMessageType.js";

/** `{command, args}` carried by a `/command arg1 arg2` text or a callback button. */
export type MultiBotCommandPayload<P = any> = {command: string, args: P};

/**
 * A message in either direction. Peers are strings of the form `<provider>:<kind>:<id>`
 * (`telegram:user:123`); `from`/`to` hold the peer and the provider name respectively for an
 * incoming message and the other way round for an outgoing one.
 *
 * @typeParam P command args, @typeParam T provider-specific `meta`, @typeParam C `context`
 * (what the provider knows about the sender: language, name, …).
 */
export default class MultiBotMessage<P = any, T = any, C = any> {
    /** Storage id; set by `storage.saveMessage`. */
    id: number;
    chat: MultiBotChat;
    from: string;
    to: string;
    providerEvent: MultiBotProviderEvent;
    /** Provider-side message id (Telegram `message_id`, VK message id). */
    providerId: string;
    type: MultiBotMessageType;
    text: string = null;
    date: Date;
    payload: MultiBotCommandPayload<P> = null;
    meta: T | null = null;
    context: C | null = null;
    template: MultiBotMessageTemplate;

    answer(template: TemplateInput) {
        return this.chat.sendMessage(template);
    }

    /** Send a prompt and route the user's NEXT message to the `input` handler registered for `input`. */
    async requestInput(input: string, template: TemplateInput) {
        await this.chat.waitInput(input);
        return this.chat.sendMessage(template);
    }

    edit(text: string) {
        return this.chat.editMessage(this, text);
    }
}
