import MultiBotKeyboardLine from "./MultiBotKeyboardLine.js";

/**
 * Messenger-agnostic keyboard: rows of buttons, inline (attached to the message) or a reply
 * keyboard (replaces the user's input panel). Each provider renders it in its own markup.
 */
export default class MultiBotKeyboardBuilder {
    lines: MultiBotKeyboardLine[] = [];
    isInline: boolean;

    line() {
        const line = new MultiBotKeyboardLine();
        this.lines.push(line);
        return line;
    }

    inline(isInline = true) {
        this.isInline = isInline;
        return this;
    }
}
