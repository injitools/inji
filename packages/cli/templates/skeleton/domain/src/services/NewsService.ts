import {LessThanOrEqual} from "typeorm";

import {RequestError} from "@injitools/core";

import {dbMain} from "../db/dataSource.js";
import NewsOrm from "../db/entities/NewsOrm.js";

// Domain service for news: the single home of the business logic, shared by every app
// (client-api reads the public feed, admin-api does CRUD, publisher flips scheduled drafts).
// Methods return NewsOrm entities — each app projects them into its OWN response DTO (a public
// subset for the client, the full record for the admin). Apps never share controllers; they
// share THIS service.

export interface NewsListFilter {
    /** Filter by publication status. Omit to return drafts and published together (admin). */
    published?: boolean;
    limit?: number;
}

export interface NewsCreateInput {
    title: string;
    body: string;
    published?: boolean;
    /** ISO-8601 string; in the future → deferred publication (created as a draft). */
    publish_at?: string | null;
    author?: string | null;
}

export interface NewsUpdateInput {
    title?: string;
    body?: string;
    published?: boolean;
    publish_at?: string | null;
}

export default class NewsService {
    static async list(filter: NewsListFilter = {}): Promise<NewsOrm[]> {
        const where: Record<string, unknown> = {};
        if (filter.published !== undefined) where.published = filter.published;
        return dbMain.manager.find(NewsOrm, {
            where,
            order: {created_at: "DESC"} as any,
            take: filter.limit ?? 50,
        });
    }

    /**
     * A single news item by id. `published` narrows by publication status:
     * omit (undefined) → any item (admin/internal use); pass `true` → published only
     * (the public feed must never leak a draft by guessing its id).
     */
    static async get(id: string, published?: boolean): Promise<NewsOrm> {
        const where: Record<string, unknown> = {id};
        if (published !== undefined) where.published = published;
        const item = await dbMain.manager.findOneBy(NewsOrm, where as any);
        if (!item) throw new RequestError(404, "News item not found", "NotFound");
        return item;
    }

    static async create(input: NewsCreateInput): Promise<NewsOrm> {
        // A future publish_at means a deferred publication: created as a draft (published=false),
        // the publisher worker flips it on schedule.
        const publishAt = input.publish_at ? new Date(input.publish_at) : null;
        const scheduled = publishAt !== null && publishAt.getTime() > Date.now();
        const item = dbMain.manager.create(NewsOrm, {
            title: input.title,
            body: input.body,
            published: scheduled ? false : (input.published ?? true),
            publish_at: publishAt,
            author: input.author ?? null,
        } as any);
        await dbMain.manager.save(item);
        return item;
    }

    static async update(id: string, patch: NewsUpdateInput): Promise<NewsOrm> {
        const item = await NewsService.get(id);
        if (patch.title !== undefined) item.title = patch.title;
        if (patch.body !== undefined) item.body = patch.body;
        if (patch.published !== undefined) item.published = patch.published;
        if (patch.publish_at !== undefined) item.publish_at = patch.publish_at ? new Date(patch.publish_at) : null;
        await dbMain.manager.save(item);
        return item;
    }

    static async remove(id: string): Promise<void> {
        const res = await dbMain.manager.delete(NewsOrm, {id} as any);
        if (!res.affected) throw new RequestError(404, "News item not found", "NotFound");
    }

    /**
     * Publish deferred drafts whose time has come: drafts (published=false) with publish_at ≤ now.
     * Rows without a schedule (publish_at=null) never match. Returns how many were published.
     * The domain operation behind the publisher worker (apps/publisher).
     */
    static async publishDue(): Promise<number> {
        const due = await dbMain.manager.find(NewsOrm, {
            where: {published: false, publish_at: LessThanOrEqual(new Date())},
        });
        if (due.length === 0) return 0;
        for (const news of due) news.published = true;
        await dbMain.manager.save(due);
        return due.length;
    }
}
