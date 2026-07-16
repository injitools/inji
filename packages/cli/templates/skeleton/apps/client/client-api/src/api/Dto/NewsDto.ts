import {ResponseDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

// PUBLIC news item — the client's RESPONSE DTO. A deliberate PUBLIC PROJECTION of NewsOrm: only the
// fields a public reader may see (no scheduling/updated meta). The admin app has its OWN NewsDto
// with the full record — same entity, different projection, one per app. @OrmLink pins each field's
// type from the column and serializes dates as ISO strings; author is nullable → optional.
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
    author?: string;

    @OrmLink()
    created_at: string;
}
