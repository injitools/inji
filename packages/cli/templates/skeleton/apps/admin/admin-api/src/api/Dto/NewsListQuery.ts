import {RequestDto, DtoProperty, coerceInt, StringBool} from "@injitools/core";

// Query parameters for the ADMIN news list — a pure REQUEST DTO. Unlike the public feed, the admin
// may filter by publication status (?published=false to review drafts) — this is why the admin app
// has its OWN query DTO with more surface than the client's. Values arrive as strings and are coerced.
@RequestDto()
export class NewsListQuery {
    @DtoProperty({optional: true, validation: coerceInt().min(1).max(100)})
    limit?: number;

    @DtoProperty({optional: true, validation: StringBool})
    published?: boolean;
}
