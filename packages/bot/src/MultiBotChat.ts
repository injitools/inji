import type MultiBot from "./MultiBot.js";
import type IMultiBotSocialProvider from "./interfaces/IMultiBotSocialProvider.js";
import {TemplateInput, toTemplate} from "./MultiBotMessageTemplate.js";
import MultiBotMessage from "./MultiBotMessage.js";
import {MultiBotMessageType} from "./MultiBotMessageType.js";

/** Storage key of the "waiting for the user's next message" marker (see MultiBot.input). */
export const WAIT_INPUT_OPTION = 'waitInput';

/**
 * A dialog between the bot and one peer on one provider. Persisted by the storage; `bot` and
 * `provider` are attached by MultiBot when the chat is loaded (see MultiBot.attachChat).
 */
export default class MultiBotChat {
    bot: MultiBot;
    id: number;
    /** Provider-scoped chat id (`telegram:bot:1:<chat_id>`); null for providers that address by peer. */
    providerId: string;
    providerName: string;
    peer: string;
    provider: IMultiBotSocialProvider;

    async waitInput(input: string | false) {
        return this.bot.storage.updateChatOption(this.id, WAIT_INPUT_OPTION, input);
    }

    async isWaitInput(): Promise<string | false> {
        const input = await this.bot.storage.getChatOption<string | false>(this.id, WAIT_INPUT_OPTION);
        return input || false;
    }

    async setOption(option: string, value: any) {
        return this.bot.storage.updateChatOption(this.id, option, value);
    }

    async getOption<T = any>(option: string) {
        return this.bot.storage.getChatOption<T>(this.id, option);
    }

    sendMessage(template: TemplateInput) {
        const msg = new MultiBotMessage();
        msg.type = MultiBotMessageType.Message;
        msg.template = toTemplate(template);
        msg.chat = this;
        msg.from = this.provider.name;
        msg.to = this.peer;
        return this.provider.sendMessage(msg);
    }

    editMessage(message: MultiBotMessage, text: string) {
        return this.provider.editMessage(message, text);
    }

    async setTypingStatus() {
        return this.provider.setTypingStatus(this);
    }
}
