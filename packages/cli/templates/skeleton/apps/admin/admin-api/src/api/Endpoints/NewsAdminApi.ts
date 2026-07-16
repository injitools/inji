import {Router, Get, Post, Put, Delete, Query, Body, Path, Meta, Response as ApiResponse, ErrorResponseDto} from "@injitools/core";

import {NewsService, RequireAdmin} from "@app/domain";
import NewsOrm from "@app/domain/db/entities/NewsOrm";
import UserOrm from "@app/domain/db/entities/UserOrm";

import {NewsDto} from "../Dto/NewsDto.js";
import {NewsListQuery} from "../Dto/NewsListQuery.js";
import {CreateNewsDto} from "../Dto/CreateNewsDto.js";
import {UpdateNewsDto} from "../Dto/UpdateNewsDto.js";
import {MessageDto} from "../Dto/MessageDto.js";

// Admin news controller (admin-api) — the FULL news surface: list (incl. drafts), create, update,
// delete. Admin role only (@RequireAdmin: adds the cookie security scheme + 401/403 to OpenAPI).
// Thin: delegates to the domain NewsService and projects entities into the admin's full NewsDto.

// Projects a news entity into the admin's full view (scheduling + updated meta included).
function toNewsDto(n: NewsOrm): NewsDto {
    return {
        id: n.id,
        title: n.title,
        body: n.body,
        published: n.published,
        publish_at: n.publish_at ? n.publish_at.toISOString() : undefined,
        author: n.author ?? undefined,
        created_at: n.created_at.toISOString(),
        updated_at: n.updated_at.toISOString(),
    };
}

@Router("news")
export default class NewsAdminApi {
    // GET /news/list — admin list; optional ?published filter (drafts included by default) and ?limit.
    @Get()
    @RequireAdmin()
    @ApiResponse(200, NewsDto)
    async list(@Query() query: NewsListQuery): Promise<NewsDto[]> {
        const items = await NewsService.list({published: query.published, limit: query.limit});
        return items.map(toNewsDto);
    }

    // POST /news/create — create. If publish_at is in the future, this is a deferred publication:
    // NewsService creates it as a draft (published=false), and the publisher worker publishes it on schedule.
    // Nothing else to declare: 400 comes from the validated @Body, 401/403 from @RequireAdmin.
    @Post()
    @RequireAdmin()
    @ApiResponse(200, NewsDto)
    async create(@Body() body: CreateNewsDto, @Meta("user") admin: UserOrm): Promise<NewsDto> {
        const item = await NewsService.create({
            title: body.title,
            body: body.body,
            published: body.published,
            publish_at: body.publish_at ?? null,
            author: admin.name,
        });
        return toNewsDto(item);
    }

    // PUT /news/:id — update (admin).
    @Put(":id")
    @RequireAdmin()
    @ApiResponse(200, NewsDto)
    @ApiResponse(404, ErrorResponseDto)
    async update(@Path("id") id: string, @Body() body: UpdateNewsDto): Promise<NewsDto> {
        const item = await NewsService.update(id, {
            title: body.title,
            body: body.body,
            published: body.published,
            publish_at: body.publish_at,
        });
        return toNewsDto(item);
    }

    // DELETE /news/:id — delete (admin).
    @Delete(":id")
    @RequireAdmin()
    @ApiResponse(200, MessageDto)
    @ApiResponse(404, ErrorResponseDto)
    async remove(@Path("id") id: string): Promise<MessageDto> {
        await NewsService.remove(id);
        return {message: "deleted"};
    }
}
