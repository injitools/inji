// @injitools/db - TypeORM integration for Inji.
// On import, it registers the ORM validation resolver in the core: after that
// @OrmDto/@OrmLink fields start being validated against column metadata.

import {setOrmZodResolver} from "@injitools/core";
import {generateOrmZodValidation} from "./ormValidation.js";

setOrmZodResolver((db, ormClass, ormProperty, direction, overrides) =>
    generateOrmZodValidation(db as any, ormClass, ormProperty, direction, overrides)
);

// --- ORM-DTO decorators ---------------------------------------------------------
export {default as OrmDto} from "./decorators/OrmDto.js";
export {default as OrmLink} from "./decorators/OrmLink.js";

// --- Connection and helpers -----------------------------------------------------
export {
    loadDbConfigFromEnv,
    dbConnect,
    dbClose,
    findOrCreate,
    updateOrCreate,
} from "./db.js";

// --- Zod generation from ORM ----------------------------------------------------
export {generateOrmZodValidation} from "./ormValidation.js";

// --- Transformers ---------------------------------------------------------------
export {BigTransformer} from "./transformers/BigTransformer.js";
export {HexTransformer} from "./transformers/HexTransformer.js";
export {IpTransformer} from "./transformers/IpTransformer.js";
