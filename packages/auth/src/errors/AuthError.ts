import {RequestError} from "@injitools/core";

export class AuthError extends RequestError {
    constructor(message: string = "Authentication Error", payload: any = null) {
        super(401, message, "AuthError", payload);
    }
}
