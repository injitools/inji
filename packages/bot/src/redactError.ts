/** An error rebuilt by {@link redactError}: the HTTP client's `code` and response status kept. */
export type RedactedError = Error & {code?: string, statusCode?: number};

/**
 * Rebuild an HTTP client's error without the request it carries.
 *
 * got keeps the whole request on its errors (options with url/form/headers/agent, the response
 * with its url — and got 14 also puts the URL into `message`), while a bot token travels inside
 * that request: in the URL path for the Bot API, in the form for VK. A caught got error that is
 * logged (`console.error(e)` inspects every property) or stored (MultiBot writes a failed
 * update's error into the event table) as is publishes the token.
 *
 * The result keeps `name`, `message`, `stack`, `code` and the response status — with every
 * secret masked as `<redacted>` — and nothing else, `cause` included.
 */
export function redactError(e: unknown, secrets: (string | undefined | null)[]): RedactedError {
    const masks = secrets
        .filter((s): s is string => !!s)
        .flatMap(s => [s, encodeURIComponent(s)]);
    const mask = (text: string) => masks.reduce((acc, s) => acc.split(s).join('<redacted>'), text);

    const source = e as {name?: string, message?: string, stack?: string, code?: unknown, response?: {statusCode?: number}} | undefined;
    const error: RedactedError = new Error(mask(String(source?.message ?? e)));
    error.name = source?.name ?? 'Error';
    error.stack = source?.stack ? mask(source.stack) : error.stack;
    if (typeof source?.code === 'string') {
        error.code = source.code;
    }
    if (typeof source?.response?.statusCode === 'number') {
        error.statusCode = source.response.statusCode;
    }
    return error;
}
