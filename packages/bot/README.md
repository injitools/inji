# @injitools/bot

Messenger-agnostic chat-bot core for the **Inji** framework. Commands, dialog input, message
templates and keyboards over pluggable **social providers** (one per messenger) and a pluggable
**storage**. The main entry depends on nothing; `@injitools/bot/typeorm` adds the TypeORM storage.

Part of the [Inji](../../README.md) monorepo.

## Install

```bash
npm install @injitools/bot @injitools/bot-telegram typeorm
```

`typeorm` is an optional peer dependency — only `@injitools/bot/typeorm` needs it.

## Usage

```ts
import {MultiBot} from "@injitools/bot";
import {MultiBotTypeOrmProvider, multiBotEntities} from "@injitools/bot/typeorm";
import {MultiBotTelegramProvider, TelegramApi} from "@injitools/bot-telegram";

// entities: [...multiBotEntities, ...yourEntities] in your DataSource
const bot = new MultiBot(new MultiBotTypeOrmProvider(dataSource.manager));
bot.addProvider(await MultiBotTelegramProvider.fromApi(new TelegramApi(process.env.TELEGRAM_BOT_TOKEN)));

bot.command('start', async (_cmd, msg) => {
    await msg.answer(t => t.text('Hello 👋').br().text('Pick one:').keyboard(k => {
        k.inline();
        k.line().button('Status').command('status');
        k.line().button('Docs').link('https://inji.ru');
    }));
});
bot.command('phone', async (_cmd, msg) => {
    await msg.requestInput('set_phone', 'Your number?');      // the NEXT message goes to the input handler
});
bot.input('set_phone', async (_input, msg) => {
    await msg.chat.setOption('phone', msg.text);
    await msg.answer('Saved.');
});
bot.message('status', async (msg) => msg.answer('All good.'));   // exact text (trimmed, lower-cased)
bot.message('*', async (msg) => msg.answer('Say /start'));     // everything else

// Telegram only reveals a block by refusing a send; VK sends message_allow/deny. Both land here.
bot.onBlocked(async (chat, blocked) => profiles.setBlocked(chat.id, blocked));

// poll every provider (see @injitools/core/lifecycle makeProcess for a supervised loop)
for (const provider of Object.values(bot.getProviders())) {
    setInterval(() => provider.pullUpdates().catch(console.error), 1000);
}
```

## How an update flows

Every provider feeds each raw update into **`bot.ingest(provider, event, parse)`**:

1. dedup by `(provider, eventId)` — an update already `executed` is skipped;
2. the raw update is stored verbatim (`MultiBotProviderEvent`);
3. the provider's `parse` maps it to `ParsedIncoming` (`from`, `providerId`, `text`, an explicit
   `payload` for callback buttons…) or returns `null` for "nothing to dispatch";
4. the chat is found or created — by peer, or by `chatProviderId` where a chat is not a peer (groups);
5. `/command args` text becomes a command; the message is stored; `onBlocked(chat, false)` fires;
6. the message is dispatched; the event is marked `executed`.

A throwing handler is logged and recorded on the stored event (`error`), which stays
`executed: false` — the poll loop continues, the failure is visible in the table.

## Peers and providers

Peers are strings `<provider>:<kind>:<id>` (`telegram:user:123`, `vk:user:456`); a provider's
`name` is `<provider>:<bot|user>:<uid>`. Register as many providers as you like — a chat knows
its provider, so `chat.sendMessage(...)` always goes to the right messenger.

Writing your own provider means implementing `IMultiBotSocialProvider` (`pullUpdates`,
`sendMessage`, `editMessage`, `setTypingStatus`) and calling `bot.ingest` — see
`@injitools/bot-telegram` for a complete one. A storage is `IMultiBotStorageProvider`;
`MultiBotMemoryStorage` is the in-memory reference implementation (tests, prototypes).

## License

MIT
