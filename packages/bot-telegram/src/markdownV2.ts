// Telegram MarkdownV2 helpers: a validator that mimics the main constraints of Telegram's
// parse_markdown_v2 (reserved characters must be escaped unless they form a markup pair;
// entities must be closed) and an auto-fixer that escapes what the validator rejects. Neither
// replicates the C++ parser 100% — they cover the collisions that actually reach the API:
// unescaped `.`/`!`/`-` in ordinary prose, unbalanced `*`/`_`, stray `]`.

// Characters Telegram treats as reserved: _ * [ ] ( ) ~ ` > # + - = | { } . !
const RESERVED = new Set(["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"]);

type EntityType =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'spoiler'
    | 'inline_code'
    | 'pre'
    | 'pre_code'
    | 'text_url'
    | 'custom_emoji'
    | 'blockquote';

/** Escape every reserved character — for text that must be shown literally. */
export function escapeMarkdownV2(text: string): string {
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

export function validateTelegramMarkdownV2(text: string): {valid: boolean; error?: string} {
    interface Entity {
        type: EntityType;
        startPos: number;
    }

    const stack: Entity[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];

        // A backslash escapes the next character.
        if (ch === '\\') {
            i += 2;
            continue;
        }

        // Inside code/pre only a backtick is special.
        const topEntity = stack.length > 0 ? stack[stack.length - 1] : undefined;
        if (topEntity && (topEntity.type === 'inline_code' || topEntity.type === 'pre' || topEntity.type === 'pre_code')) {
            if (ch === '`') {
                if (topEntity.type === 'inline_code') {
                    stack.pop();
                } else if (text.slice(i, i + 3) === '```') {
                    stack.pop();
                    i += 2;
                }
            }
            i++;
            continue;
        }

        if (RESERVED.has(ch)) {
            switch (ch) {
                case '*': {
                    if (stack.length > 0 && stack[stack.length - 1].type === 'bold') {
                        stack.pop();
                    } else {
                        stack.push({type: 'bold', startPos: i});
                    }
                    i++;
                    continue;
                }
                case '_': {
                    // single `_` italic, double `__` underline
                    if (text[i + 1] === '_') {
                        if (stack.length > 0 && stack[stack.length - 1].type === 'underline') {
                            stack.pop();
                        } else {
                            stack.push({type: 'underline', startPos: i});
                        }
                        i += 2;
                    } else {
                        if (stack.length > 0 && stack[stack.length - 1].type === 'italic') {
                            stack.pop();
                        } else {
                            stack.push({type: 'italic', startPos: i});
                        }
                        i++;
                    }
                    continue;
                }
                case '~': {
                    if (stack.length > 0 && stack[stack.length - 1].type === 'strikethrough') {
                        stack.pop();
                    } else {
                        stack.push({type: 'strikethrough', startPos: i});
                    }
                    i++;
                    continue;
                }
                case '`': {
                    if (text.slice(i, i + 3) === '```') {
                        stack.push({type: 'pre', startPos: i});
                        i += 3;
                    } else {
                        stack.push({type: 'inline_code', startPos: i});
                        i++;
                    }
                    continue;
                }
                case '!': {
                    // `![` opens a custom emoji; a bare `!` must be escaped.
                    if (i + 1 < text.length && text[i + 1] === '[') {
                        stack.push({type: 'custom_emoji', startPos: i});
                        i++;
                    } else {
                        return {valid: false, error: `Unescaped '!' at position ${i} is invalid in Telegram Markdown V2.`};
                    }
                    i++;
                    continue;
                }
                case '[': {
                    stack.push({type: 'text_url', startPos: i});
                    i++;
                    continue;
                }
                case ']': {
                    if (stack.length > 0) {
                        const last = stack[stack.length - 1];
                        if (last.type === 'text_url' || last.type === 'custom_emoji') {
                            stack.pop();
                        } else {
                            return {valid: false, error: `']' encountered but top of stack is ${last.type}, mismatch at position ${i}.`};
                        }
                    } else {
                        return {valid: false, error: `']' encountered with no matching '[' at position ${i}.`};
                    }
                    i++;
                    continue;
                }
                case '(':
                case ')': {
                    // URL part of a text link; not parsed further.
                    i++;
                    continue;
                }
                case '>': {
                    stack.push({type: 'blockquote', startPos: i});
                    i++;
                    continue;
                }
                default: {
                    return {valid: false, error: `Unescaped reserved character '${ch}' at position ${i}. Must escape or remove.`};
                }
            }
        }

        i++;
    }

    if (stack.length > 0) {
        const last = stack[stack.length - 1];
        return {valid: false, error: `Unclosed entity '${last.type}' started at position ${last.startPos}.`};
    }

    return {valid: true};
}

/**
 * Best-effort repair so the API accepts the text: reserved characters that do not open/close a
 * markup construct are escaped, entities left unclosed at the end get their opening markup
 * escaped. Already-escaped characters and code/pre contents are kept as is.
 */
export function autoFixTelegramMarkdownV2(text: string): string {
    interface Entity {
        type: EntityType;
        /** index in `result` where the opening markup was written */
        openPos: number;
        openMarkup: string;
    }

    const stack: Entity[] = [];
    const result: string[] = [];
    const escapeChar = (c: string) => `\\${c}`;

    // Unclosed entities: turn their opening markup (already in `result`) into its escaped form.
    // Multi-character markup ('__', '```', '![') was pushed as ONE array element, so exactly one
    // element is replaced — splicing `markup.length` elements would eat the text after it.
    function escapeUnclosedEntities() {
        for (let i = stack.length - 1; i >= 0; i--) {
            const entity = stack[i];
            result.splice(entity.openPos, 1, entity.openMarkup.split('').map(escapeChar).join(''));
        }
    }

    let i = 0;
    while (i < text.length) {
        const ch = text[i];

        if (ch === '\\') {
            if (i + 1 < text.length) {
                result.push(ch, text[i + 1]);
                i += 2;
            } else {
                result.push(ch);
                i += 1;
            }
            continue;
        }

        const top = stack[stack.length - 1];
        if (top && (top.type === 'inline_code' || top.type === 'pre')) {
            if (ch === '`') {
                if (top.type === 'inline_code') {
                    stack.pop();
                    result.push('`');
                } else if (text.slice(i, i + 3) === '```') {
                    stack.pop();
                    result.push('```');
                    i += 3;
                    continue;
                } else {
                    // a single backtick inside ``` … ``` — escape to stay compatible
                    result.push(escapeChar('`'));
                }
                i++;
                continue;
            }
            result.push(ch);
            i++;
            continue;
        }

        if (RESERVED.has(ch)) {
            switch (ch) {
                case '*': {
                    const last = stack[stack.length - 1];
                    if (last?.type === 'bold') {
                        stack.pop();
                    } else {
                        stack.push({type: 'bold', openPos: result.length, openMarkup: '*'});
                    }
                    result.push('*');
                    i++;
                    continue;
                }
                case '_': {
                    if (text[i + 1] === '_') {
                        const last = stack[stack.length - 1];
                        if (last?.type === 'underline') {
                            stack.pop();
                        } else {
                            stack.push({type: 'underline', openPos: result.length, openMarkup: '__'});
                        }
                        result.push('__');
                        i += 2;
                    } else {
                        const last = stack[stack.length - 1];
                        if (last?.type === 'italic') {
                            stack.pop();
                        } else {
                            stack.push({type: 'italic', openPos: result.length, openMarkup: '_'});
                        }
                        result.push('_');
                        i++;
                    }
                    continue;
                }
                case '~': {
                    const last = stack[stack.length - 1];
                    if (last?.type === 'strikethrough') {
                        stack.pop();
                    } else {
                        stack.push({type: 'strikethrough', openPos: result.length, openMarkup: '~'});
                    }
                    result.push('~');
                    i++;
                    continue;
                }
                case '`': {
                    if (text.slice(i, i + 3) === '```') {
                        stack.push({type: 'pre', openPos: result.length, openMarkup: '```'});
                        result.push('```');
                        i += 3;
                    } else {
                        stack.push({type: 'inline_code', openPos: result.length, openMarkup: '`'});
                        result.push('`');
                        i++;
                    }
                    continue;
                }
                case '!': {
                    if (text[i + 1] === '[') {
                        stack.push({type: 'custom_emoji', openPos: result.length, openMarkup: '!['});
                        result.push('![');
                        i += 2;
                    } else {
                        result.push(escapeChar('!'));
                        i++;
                    }
                    continue;
                }
                case '[': {
                    stack.push({type: 'text_url', openPos: result.length, openMarkup: '['});
                    result.push('[');
                    i++;
                    continue;
                }
                case ']': {
                    const last = stack[stack.length - 1];
                    if (last?.type === 'text_url' || last?.type === 'custom_emoji') {
                        stack.pop();
                        result.push(']');
                    } else {
                        result.push(escapeChar(']'));
                    }
                    i++;
                    continue;
                }
                case '>': {
                    stack.push({type: 'blockquote', openPos: result.length, openMarkup: '>'});
                    result.push('>');
                    i++;
                    continue;
                }
                default: {
                    // #, +, -, =, |, {, }, ., ( , ) — not markup here, escape.
                    result.push(escapeChar(ch));
                    i++;
                    continue;
                }
            }
        }

        result.push(ch);
        i++;
    }

    if (stack.length > 0) {
        escapeUnclosedEntities();
    }

    return result.join('');
}

/** `text` if the validator accepts it, otherwise the auto-fixed version. */
export function ensureMarkdownV2(text: string): string {
    return validateTelegramMarkdownV2(text).valid ? text : autoFixTelegramMarkdownV2(text);
}
