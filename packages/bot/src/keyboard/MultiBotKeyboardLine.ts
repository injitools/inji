import MultiBotKeyboardButton from "./MultiBotKeyboardButton.js";

/** One row of buttons. */
export default class MultiBotKeyboardLine {
    buttons: MultiBotKeyboardButton[] = [];

    button(text: string) {
        const btn = new MultiBotKeyboardButton(text);
        this.buttons.push(btn);
        return btn;
    }
}
