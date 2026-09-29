/** What an incoming/outgoing message is: free text, or a command (`/start`, a keyboard callback). */
export enum MultiBotMessageType {
    Message = 'message',
    Command = 'command',
}
