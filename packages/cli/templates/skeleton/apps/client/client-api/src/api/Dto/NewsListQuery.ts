import {RequestDto, DtoProperty, coerceInt} from "@injitools/core";

// Query parameters for the PUBLIC news feed — a pure REQUEST DTO. Only `limit`: the public feed
// always returns published items (a reader can never request drafts — that is an admin concern,
// handled by the admin app's own query DTO). limit arrives as a string (?limit=10), coerceInt coerces.
@RequestDto()
export class NewsListQuery {
    @DtoProperty({optional: true, validation: coerceInt().min(1).max(100)})
    limit?: number;
}
