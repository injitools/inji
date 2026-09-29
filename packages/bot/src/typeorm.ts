// @injitools/bot/typeorm — the TypeORM storage for MultiBot (subpath so the main entry stays free
// of typeorm). Add `multiBotEntities` to the entities of your DataSource.

export {default as MultiBotTypeOrmProvider} from "./storage/typeorm/MultiBotTypeOrmProvider.js";
export {multiBotEntities} from "./storage/typeorm/entities/index.js";
export {default as MultiBotChatOrm} from "./storage/typeorm/entities/MultiBotChatOrm.js";
export {default as MultiBotChatOptionOrm} from "./storage/typeorm/entities/MultiBotChatOptionOrm.js";
export {default as MultiBotChatMessageOrm} from "./storage/typeorm/entities/MultiBotChatMessageOrm.js";
export {default as MultiBotProviderEventOrm} from "./storage/typeorm/entities/MultiBotProviderEventOrm.js";
export {default as MultiBotProviderOptionsOrm} from "./storage/typeorm/entities/MultiBotProviderOptionsOrm.js";
