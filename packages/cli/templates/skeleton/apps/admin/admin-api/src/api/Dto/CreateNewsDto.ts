import {RequestDto, DtoProperty, IsoDateTime} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

// News creation body — a REQUEST DTO with validation derived from the NewsOrm columns:
//  • title  varchar(200)        → string, max 200, required
//  • body   text                → string, required
//  • published boolean default  → boolean, optional (has a default)
// This is exactly "validation from TypeORM entities": the entity is the single source of truth.
@RequestDto(NewsOrm, dbMain)
export class CreateNewsDto {
    @OrmLink()
    title: string;

    @OrmLink()
    body: string;

    @OrmLink()
    published?: boolean;

    // publish_at is not derived from the ORM: on the wire it is an ISO string, while in the entity it is a Date.
    // We define it with an explicit Zod schema. If the time is in the future, publication is deferred (see NewsAdminApi).
    @DtoProperty({optional: true, validation: IsoDateTime})
    publish_at?: string;
}
