import {ValidationError} from "./ValidationError.js";
import {flattenZodIssues, type ValidationErrorPayload} from "@injitools/contract";
import type {ZodError} from "zod";

/**
 * A Zod validation error. The hierarchy is preserved (ValidationError → RequestError, code 400),
 * but the payload now carries a web-friendly field breakdown {formErrors, fieldErrors}
 * — exactly the structure the frontend uses to highlight form fields.
 * The raw issues remain available on .issues for server-side logging/debugging.
 */
export class ZodValidationError extends ValidationError {
    readonly issues: ZodError["issues"];
    readonly fieldErrors: ValidationErrorPayload["fieldErrors"];
    readonly formErrors: ValidationErrorPayload["formErrors"];

    constructor(issues: ZodError["issues"]) {
        const flat = flattenZodIssues(issues);
        // canonical ErrorResponseDto payload = {formErrors, fieldErrors}
        super("Validation Error", flat);
        this.type = "ZodValidationError";
        this.issues = issues;
        this.fieldErrors = flat.fieldErrors;
        this.formErrors = flat.formErrors;
    }
}
