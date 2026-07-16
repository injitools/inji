import {RequestDto} from "@injitools/core";
import {OrmLink} from "@injitools/db";

import {dbMain} from "@app/domain/db/dataSource";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

// News creation body — a REQUEST DTO with validation derived from the NewsOrm columns:
//  • title  varchar(200)        → string, max 200, required
//  • body   text                → string, required
//  • published boolean default  → boolean, optional (has a default)
//  • publish_at timestamptz     → ISO-8601 string with an offset on the wire, parsed to a Date,
//                                 optional (the column is nullable)
// This is exactly "validation from TypeORM entities": the entity is the single source of truth.
@RequestDto(NewsOrm, dbMain)
export class CreateNewsDto {
    @OrmLink()
    title: string;

    @OrmLink()
    body: string;

    @OrmLink()
    published?: boolean;

    // If the time is in the future, publication is deferred (see NewsAdminApi).
    @OrmLink()
    publish_at?: Date;
}
