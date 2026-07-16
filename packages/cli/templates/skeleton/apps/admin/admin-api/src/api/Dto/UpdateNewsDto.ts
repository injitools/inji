import {RequestDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

// Partial news update body — a REQUEST DTO. Every column-backed field is optional (a PATCH sends
// only what changes), so @OrmLink({optional: true}) keeps deriving the type/length from NewsOrm
// while forcing optionality.
@RequestDto(NewsOrm, dbMain)
export class UpdateNewsDto {
    @OrmLink({optional: true})
    title?: string;

    @OrmLink({optional: true})
    body?: string;

    @OrmLink({optional: true})
    published?: boolean;

    @OrmLink({optional: true})
    publish_at?: Date;
}
