import {RequestError} from "./RequestError.js";

export class ValidationError extends RequestError {
    constructor(message: string = "Validation Error", payload: any = null) {
        super(400, message, "ValidationError", payload);
    }
}
