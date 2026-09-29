# @injitools/bot-telegram

Telegram provider for [`@injitools/bot`](../bot): a thin **Bot API client** (`got`, optional
SOCKS5 proxy, errors with the API's `error_code`) and the **MultiBot social provider** on top of
it — long polling with the offset persisted, `message`/`callback_query` → MultiBot messages,
MarkdownV2 rendering with validate-then-auto-escape, inline and reply keyboards, block detection.

Part of the [Inji](../../README.md) monorepo.

## Install

```bash
npm install @injitools/bot @injitools/bot-telegram
```

## Usage

```ts
import {MultiBot} from "@injitools/bot";
import {MultiBotTelegramProvider, TelegramApi} from "@injitools/bot-telegram";

const api = new TelegramApi(process.env.TELEGRAM_BOT_TOKEN);           // {proxyUrl: 'socks5h://…'} or TELEGRAM_PROXY_URL
const provider = await MultiBotTelegramProvider.fromApi(api);           // name: telegram:bot:<id>
bot.addProvider(provider);

await provider.pullUpdates();            // one getUpdates round (25 s long poll), dispatched through bot.ingest
await provider.handleUpdate(update);     // …or feed a webhook body
```

`handleUpdate` trusts what it is given — authenticating the webhook is the caller's job. Register
it with `setWebhook({secret_token})` and reject any request whose `X-Telegram-Bot-Api-Secret-Token`
header does not match before passing the body on; otherwise anyone who learns the URL can post
updates as any user.

Failed requests never carry the token: the Bot API has it in every URL, so `TelegramApi` rebuilds
got's errors with the token masked instead of letting them out with the request attached.

Outgoing text is rendered as MarkdownV2: valid markup passes as is, anything the API would
reject (`.`, `!`, an unbalanced `*`) is escaped by `ensureMarkdownV2`. Use `escapeMarkdownV2`
for text that must be shown literally.

A `403` from `sendMessage` is the only way to learn that the peer blocked the bot: the provider
calls `bot.onBlocked(chat, true)` and **re-throws** — the caller sees the message did not go out.
Every successful send and every incoming message report `false`.

`TelegramApi` also covers `getChat`, `getFile`/`downloadFile`, `sendPhoto`, `editMessageText`,
`deleteMessage`, `sendChatAction`, `answerCallbackQuery`, `sendInvoice`/`answerPreCheckoutQuery`,
and `getCommand`/`postCommand` for everything else.

## License

MIT
