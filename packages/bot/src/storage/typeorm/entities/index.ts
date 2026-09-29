import MultiBotChatOrm from "./MultiBotChatOrm.js";
import MultiBotChatOptionOrm from "./MultiBotChatOptionOrm.js";
import MultiBotChatMessageOrm from "./MultiBotChatMessageOrm.js";
import MultiBotProviderEventOrm from "./MultiBotProviderEventOrm.js";
import MultiBotProviderOptionsOrm from "./MultiBotProviderOptionsOrm.js";

/** All MultiBot entities — spread into the `entities` of your DataSource. */
export const multiBotEntities = [
    MultiBotProviderEventOrm,
    MultiBotProviderOptionsOrm,
    MultiBotChatOrm,
    MultiBotChatOptionOrm,
    MultiBotChatMessageOrm,
];
