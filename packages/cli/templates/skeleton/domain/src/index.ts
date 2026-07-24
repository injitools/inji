// Project core (@app/domain): the business layer shared by every app (client-api, admin-api,
// publisher). It holds ONLY domain concerns — TypeORM entities + DataSource, domain services
// (business logic), and auth wiring (cookie session + the RequireRole guard from @injitools/auth,
// configured for our user). No controllers
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

// Auth is provided by @injitools/auth; here we only re-export our wired-up pieces. Password hashing
// is used as-is; cookie session + the RequireRole guard are configured for our user in auth/auth.ts.
export {hashPassword, verifyPassword} from "@injitools/auth";
export * from "./auth/auth.js";

// Generic per-endpoint rate limit (@RateLimit), bound to our DataSource in rate-limit/rateLimit.ts.
export {RateLimit, resetRateLimit} from "./rate-limit/rateLimit.js";
