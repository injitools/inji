// Parsing Zod errors into a frontend-friendly form. Browser-safe:
// depends only on the ZodIssue type, without the express/typeorm runtime — so the web imports
// the SAME field type that the server puts into ErrorResponseDto.payload.
//
// The format mirrors Zod flatten(): { formErrors, fieldErrors } — exactly what the
// checkin-adventure frontend expects for highlighting form fields.
// A structural issue type (path + message) instead of the zod type: it decouples us from the evolution
// of zod's internal types (ZodIssue is marked deprecated in v4) and accepts both ZodError.issues
// and any compatible source.
type IssueLike = {path: PropertyKey[]; message: string};

/** Errors by top-level field name: { fieldName: ["message", ...] }. */
export type ZodFieldErrors = Record<string, string[]>;

/**
 * The payload shape of the canonical ErrorResponseDto for validation errors.
 * - formErrors — form-level errors (issue.path is empty: e.g. strictObject rejecting an extra key);
 * - fieldErrors — errors tied to a specific field (by the first path segment).
 */
export interface ValidationErrorPayload {
    formErrors: string[];
    fieldErrors: ZodFieldErrors;
}

/**
 * Turns an array of ZodIssue into { formErrors, fieldErrors } — like Zod flatten(), but from issues
 * directly (on the server we already have the issues, no ZodError instance is needed). Grouping is done
 * by the first path segment (nested errors are aggregated onto the top-level field — this is exactly
 * flatten's behavior, sufficient for highlighting form fields).
 */
export function flattenZodIssues(issues: readonly IssueLike[]): ValidationErrorPayload {
    const formErrors: string[] = [];
    const fieldErrors: ZodFieldErrors = {};

    for (const issue of issues) {
        if (!issue.path || issue.path.length === 0) {
            formErrors.push(issue.message);
            continue;
        }
        const key = String(issue.path[0]);
        (fieldErrors[key] ??= []).push(issue.message);
    }

    return {formErrors, fieldErrors};
}

/** Type-guard: the payload looks like a ValidationErrorPayload (for parsing the response on the web side). */
export function isValidationErrorPayload(payload: unknown): payload is ValidationErrorPayload {
    return (
        typeof payload === "object" &&
        payload !== null &&
        "fieldErrors" in payload &&
        "formErrors" in payload &&
        Array.isArray((payload as ValidationErrorPayload).formErrors)
    );
}
