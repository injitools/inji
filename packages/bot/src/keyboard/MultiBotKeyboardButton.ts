export enum ButtonType {
    /** Plain text button: the messenger sends its label back as a regular message. */
    SEND_MESSAGE,
    /** Callback button: the bot receives `{command, args}` and dispatches it as a command. */
    COMMAND,
    /** Opens a URL. */
    LINK,
}

export default class MultiBotKeyboardButton {
    type = ButtonType.SEND_MESSAGE;
    public commandName: string;
    public commandArgs: any;
    public url: string;

    constructor(public text: string) {
    }

    command(name: string, args?: any) {
        this.type = ButtonType.COMMAND;
        this.commandName = name;
        this.commandArgs = args;
        return this;
    }

    link(url: string) {
        this.type = ButtonType.LINK;
        this.url = url;
        return this;
    }
}
