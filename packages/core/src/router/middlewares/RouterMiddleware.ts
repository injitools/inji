// The wrapper class lets a middleware carry metadata for the OpenAPI generator,
// while at runtime Express uses the handler field (the handler function).

import {RequestHandler} from "express-serve-static-core";
import type {ZodOpenApiSecuritySchemeObject} from "zod-openapi";

import type {TRouterResponse} from "../storages/RoutesStorage.js";

export type OpenApiMiddlewareMeta = {
    // Security scheme definitions that will end up in components.securitySchemes
    securitySchemes?: Record<string, ZodOpenApiSecuritySchemeObject>
    // Additional responses the route should register
    responses?: TRouterResponse[]
}

export default class RouterMiddleware {
    handler: RequestHandler
    openapi: OpenApiMiddlewareMeta = {
        securitySchemes: {},
        responses: [],
    }

    constructor(handler: RequestHandler) {
        this.handler = handler
    }

    // Set an entire metadata block at once
    meta(meta: OpenApiMiddlewareMeta) {
        if (meta.securitySchemes) {
            for (const [name, scheme] of Object.entries(meta.securitySchemes)) {
                this.security(name, scheme)
            }
        }
        if (meta.responses?.length) {
            this.openapi.responses.push(...meta.responses)
        }
        return this
    }

    // Add a security scheme and requirement for the current route
    security(name: string, scheme: ZodOpenApiSecuritySchemeObject) {
        this.openapi.securitySchemes[name] = this.openapi.securitySchemes[name] || scheme
        return this
    }

    // Add responses the route should have
    responses(...items: TRouterResponse[]) {
        this.openapi.responses.push(...items)
        return this
    }
}

export function createMiddleware(handler: RequestHandler) {
    return new RouterMiddleware(handler)
}
