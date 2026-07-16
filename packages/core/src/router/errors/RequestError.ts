export class RequestError extends Error {
    public code: number;
    public type: string;
    public payload: any;
    public inherit: string[] = [];

    constructor(code: number, message: string, type: string, payload: any = null) {
        super(message);
        this.code = code;
        this.type = type;
        this.payload = payload;
        this.collectInheritance();
    }

    private collectInheritance() {
        let proto = Object.getPrototypeOf(this.constructor);
        while (proto && proto.name && proto.name !== 'Error' && proto.name !== 'Object') {
            this.inherit.push(proto.name);
            proto = Object.getPrototypeOf(proto);
        }
    }
}
