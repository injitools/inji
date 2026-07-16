import {ResponseDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import UserOrm from "@app/domain/db/entities/UserOrm";

// Public representation of the current user (no secrets) — a RESPONSE DTO derived from UserOrm.
// A subset of the entity's columns: password_hash is simply not linked, so it can never leak.
// id — bigint (int64): a string on the wire, branded Int64 for the frontend.
@ResponseDto(UserOrm, dbMain)
export class AuthUserDto {
    @OrmLink()
    id: bigint;

    @OrmLink()
    login: string;

    @OrmLink()
    name: string;

    @OrmLink()
    role: string;
}
