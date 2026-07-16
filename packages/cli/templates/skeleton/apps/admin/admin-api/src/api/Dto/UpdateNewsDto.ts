import {RequestDto, DtoProperty, IsoDateTime} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

// Partial news update body — a REQUEST DTO. Every column-backed field is optional (a PATCH sends
// only what changes), so @OrmLink({optional: true}) keeps deriving the type/length from NewsOrm
// while forcing optionality. publish_at is an ISO string on the wire (Date in the entity), so it
// is declared explicitly.
@RequestDto(NewsOrm, dbMain)
export class UpdateNewsDto {
    @OrmLink({optional: true})
    title?: string;

    @OrmLink({optional: true})
    body?: string;

    @OrmLink({optional: true})
    published?: boolean;

    @DtoProperty({optional: true, validation: IsoDateTime})
    publish_at?: string;
}
