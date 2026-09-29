# @injitools/bot-vk

VK provider for [`@injitools/bot`](../bot): a thin **community API client** (`call`, Bots Long
Poll, messages, photo upload) and the **MultiBot social provider** on top of it — long poll with
`failed` recovery, `message_new`/`message_event` → MultiBot messages, VK keyboards,
`message_allow`/`message_deny` → the blocked hook.

Part of the [Inji](../../README.md) monorepo.

## Install

```bash
npm install @injitools/bot @injitools/bot-vk
```

## Usage

```ts
import {MultiBot} from "@injitools/bot";
import {MultiBotVkProvider, VkApi, VkApiUserType} from "@injitools/bot-vk";

const api = new VkApi(process.env.VK_COMMUNITY_KEY);
const provider = new MultiBotVkProvider(+process.env.VK_GROUP_ID, VkApiUserType.Bot, api);   // name: vk:bot:<group id>
bot.addProvider(provider);

await provider.pullUpdates();             // one Bots Long Poll round (25 s), dispatched through bot.ingest
await provider.handleUpdates(updates);    // …or feed Callback API events
```

`handleUpdates` trusts what it is given — authenticating the Callback API is the caller's job:
set a secret key in the community settings and drop any event whose `secret` field does not match
(and answer `type: 'confirmation'` with the confirmation string yourself) before passing events on.

Failed requests never carry the token or the Long Poll key: `VkApi` rebuilds got's errors with
them masked instead of letting them out with the request attached.

Chats are addressed by peer (`vk:user:<id>`). Templates render as plain text; keyboards become
VK `text` / `callback` / `open_link` buttons. A `messages.send` refusal with code 7, 15, 901 or
902 (`VkApiError.isBlocked`) calls `bot.onBlocked(chat, true)` and **re-throws**.

`editMessage` is not implemented for VK and throws.

## License

MIT
