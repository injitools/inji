import {z} from "zod";
import {RequestDto, DtoProperty} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import UserOrm from "@app/domain/db/entities/UserOrm";

// Registration body — a REQUEST DTO with a mixed derivation:
//  • login / name — @OrmLink: validation is DERIVED from UserOrm columns with input semantics
//    (login varchar(64) → max 64 + required, name varchar(120) → max 120 + required).
//    Change the column length on the entity and validation adapts automatically.
//  • password — not a DB column (we store only the hash), so a plain @DtoProperty
//    with an explicit zod schema.
@RequestDto(UserOrm, dbMain)
export class RegisterDto {
    @OrmLink()
    login: string;

    @OrmLink()
    name: string;

    @DtoProperty({validation: z.string().min(6).max(128)})
    password: string;
}
