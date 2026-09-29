import MultiBotKeyboardBuilder from "./keyboard/MultiBotKeyboardBuilder.js";

export enum EntityType {
    TEXT = 'text',
    BR = 'br',
    LINK = 'link',
}

export type TemplateEntity = {type: EntityType, text?: string, style?: 'bold' | 'regular', href?: string};

export type TemplateAttachment = {type: 'image', caption: string, path: string};

/** Output format a provider asks the template to render in (see IMultiBotSocialProvider.msgFormats). */
export type TemplateFormat = 'text' | 'html' | (string & {});

/**
 * Messenger-agnostic outgoing message: text entities, an optional keyboard and attachments.
 * `build(format)` renders the entities for a given provider format; anything but `html` falls
 * back to plain text (links become `text ( href )`).
 */
export default class MultiBotMessageTemplate {
    private entities: TemplateEntity[] = [];
    keyboardBuilder: MultiBotKeyboardBuilder;
    attachments: TemplateAttachment[] = [];

    text(text: string, style: 'bold' | 'regular' = 'regular') {
        this.entities.push({type: EntityType.TEXT, text, style});
        return this;
    }

    br() {
        this.entities.push({type: EntityType.BR});
        return this;
    }

    link(text: string, href: string) {
        this.entities.push({type: EntityType.LINK, text, href});
        return this;
    }

    build(format: TemplateFormat = 'text') {
        const pieces: string[] = [];
        for (const entity of this.entities) {
            switch (entity.type) {
                case EntityType.LINK:
                    switch (format) {
                        case 'html':
                            pieces.push(`<a href="${entity.href}">${entity.text}</a>`);
                            break;
                        default:
                            pieces.push(`${entity.text} ( ${entity.href} )`);
                    }
                    break;
                case EntityType.BR:
                    pieces.push('\n');
                    break;
                default:
                    switch (format) {
                        case 'html':
                            pieces.push(entity.style === 'bold' ? `<b>${entity.text}</b>` : entity.text);
                            break;
                        default:
                            pieces.push(entity.text);
                    }
            }
        }
        return pieces.join(' ');
    }

    keyboard(param: MultiBotKeyboardBuilder | ((b: MultiBotKeyboardBuilder) => void)) {
        if (param instanceof MultiBotKeyboardBuilder) {
            this.keyboardBuilder = param;
            return this;
        }
        this.keyboardBuilder = this.keyboardBuilder || new MultiBotKeyboardBuilder();
        param(this.keyboardBuilder);
        return this;
    }

    image(caption: string, path: string) {
        this.attachments.push({type: 'image', caption, path});
        return this;
    }
}

/** Anything `chat.sendMessage`/`message.answer` accept: a string, a template, or a builder callback. */
export type TemplateInput = string | MultiBotMessageTemplate | ((t: MultiBotMessageTemplate) => MultiBotMessageTemplate);

export function toTemplate(template: TemplateInput): MultiBotMessageTemplate {
    switch (typeof template) {
        case "function":
            return template(new MultiBotMessageTemplate());
        case "string":
            return new MultiBotMessageTemplate().text(template);
        default:
            return template;
    }
}
