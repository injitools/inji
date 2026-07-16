import {Router, Get, Query, Path, Response as ApiResponse, ErrorResponseDto} from "@injitools/core";

import {NewsService} from "@app/domain";
import NewsOrm from "@app/domain/db/entities/NewsOrm";

import {NewsDto} from "../Dto/NewsDto.js";
import {NewsListQuery} from "../Dto/NewsListQuery.js";

// Public news controller (client-api) — read-only, published items only. Thin: delegates to
// NewsService and projects entities into the PUBLIC NewsDto (no scheduling/updated meta).

// Projects a news entity into the client's public shape.
function toNewsDto(n: NewsOrm): NewsDto {
    return {
        id: n.id,
        title: n.title,
        body: n.body,
        published: n.published,
        author: n.author ?? undefined,
        created_at: n.created_at.toISOString(),
    };
}

@Router("news")
export default class NewsApi {
    // GET /news/list — public feed (published only; optional ?limit).
    @Get()
    @ApiResponse(200, NewsDto)
    async list(@Query() query: NewsListQuery): Promise<NewsDto[]> {
        const items = await NewsService.list({published: true, limit: query.limit});
        return items.map(toNewsDto);
    }

    // GET /news/:id — a single published news item. `published:true` so a reader can never
    // fetch a draft/scheduled item by guessing its id (a 404 hides its very existence).
    @Get(":id")
    @ApiResponse(200, NewsDto)
    @ApiResponse(404, ErrorResponseDto)
    async get(@Path("id") id: string): Promise<NewsDto> {
        return toNewsDto(await NewsService.get(id, true));
    }
}
