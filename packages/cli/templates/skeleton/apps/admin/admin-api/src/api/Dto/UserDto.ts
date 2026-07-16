import {ResponseDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import UserOrm from "@app/domain/db/entities/UserOrm";

// A user as the ADMIN sees it — a RESPONSE DTO derived from UserOrm with the FULL record (the admin
// projection): all columns except the secret password_hash, plus created_at/last_seen meta the
// public client never sees. Used for the admin's current user (login / me) and the user list.
// created_at is serialized as an ISO string; last_seen is nullable → optional.
// id — bigint (int64): a string on the wire, branded Int64 for the frontend.
@ResponseDto(UserOrm, dbMain)
export class UserDto {
    @OrmLink()
    id: bigint;

    @OrmLink()
    login: string;

    @OrmLink()
    name: string;

    @OrmLink()
    role: string;

    @OrmLink()
    created_at: string;

    @OrmLink()
    last_seen?: string;
}
