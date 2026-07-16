// Project core (@app/domain): the business layer shared by every app (client-api, admin-api,
// publisher). It holds ONLY domain concerns — TypeORM entities + DataSource, domain services
// (business logic), and auth (cookie sessions, passwords, authorization guards). No controllers
// and no API DTOs live here: those are owned by each app under apps/<app>/src/api. Apps reuse
// logic by calling these services, never by sharing controllers.
//
// Import via the barrel (`import {NewsService, NewsOrm} from "@app/domain"`)
// or directly by subpath (`import NewsOrm from "@app/domain/db/entities/NewsOrm"`).

export {dbMain} from "./db/dataSource.js";
export {default as UserOrm} from "./db/entities/UserOrm.js";
export {default as NewsOrm} from "./db/entities/NewsOrm.js";

// Domain services — business logic. Apps' controllers stay thin and delegate here.
export {default as NewsService} from "./services/NewsService.js";
export type {NewsListFilter, NewsCreateInput, NewsUpdateInput} from "./services/NewsService.js";
export {default as UserService} from "./services/UserService.js";
export type {RegisterInput} from "./services/UserService.js";

export * from "./auth/password.js";
export * from "./auth/auth.js";
export * from "./auth/guards.js";

// Shared infra: a DB-backed fixed-window rate-limit guard (@RateLimit), like the auth guards above.
export {default as RateLimitOrm} from "./db/entities/RateLimitOrm.js";
export {RateLimit, hitRateLimit} from "./rate-limit/rateLimit.js";
export type {RateLimitOptions} from "./rate-limit/rateLimit.js";
