import {ResponseDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import UserOrm from "@app/domain/db/entities/UserOrm";

// The signed-in admin (no secrets) — a RESPONSE DTO derived from UserOrm, returned by login/me.
// A per-app copy: the admin app owns its own auth DTOs. It is a slim identity view (id/login/name/
// role); the fuller UserDto (with created_at/last_seen) is used for the user-management list.
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
