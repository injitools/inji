import {ResponseDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

// News as the ADMIN sees it — a RESPONSE DTO derived from NewsOrm with the FULL record (the admin
// projection): scheduling (publish_at) and updated_at meta that the public client's NewsDto omits.
// Same entity, a different projection than apps/client/client-api — one DTO per app, no sharing.
// @OrmLink serializes dates as ISO strings; nullable columns (author, publish_at) → optional.
// id — bigint (int64): a string on the wire, branded Int64 for the frontend.
@ResponseDto(NewsOrm, dbMain)
export class NewsDto {
    @OrmLink()
    id: bigint;

    @OrmLink()
    title: string;

    @OrmLink()
    body: string;

    @OrmLink()
    published: boolean;

    @OrmLink()
    publish_at?: string;

    @OrmLink()
    author?: string;

    @OrmLink()
    created_at: string;

    @OrmLink()
    updated_at: string;
}
