import express, {type NextFunction, type Request, type Response} from "express";
import {ZodOpenApiPathsObject, ZodOpenApiSecuritySchemeObject, ZodOpenApiPathItemObject} from "zod-openapi";
import {ZodError, z, ZodObject} from "zod";

import RoutesStorage, {
    HttpMethod,
    TRouterMethodParam,
    TRouterRecord,
    TRouterResponse
} from "./storages/RoutesStorage.js";
import type {MiddlewareLike} from "./storages/RoutesStorage.js";
import {detectContentType, generateSchema, DtoStorage, dataToDto, ErrorResponseDto} from "@injitools/contract";
import {ZodValidationError} from "./errors/ZodValidationError.js";

type Route = {
    router: TRouterRecord,
    method: HttpMethod,
    path: string,
    instance: unknown,
    methodProperty: string,
    inputs: (TRouterMethodParam & { validator?: ZodObject })[],
    responses: TRouterResponse[],
    middlewares: MiddlewareLike[],
}

export default class Router {
    routes: Route[] = []

    constructor(routerObjects: (new () => unknown)[]) {
        this.parseRoutes(routerObjects)
    }

    parseRoutes(routerObjects: (new () => unknown)[]) {
        for (const Ctor of routerObjects) {
            const router = RoutesStorage.get(Ctor)
            const instance = new Ctor()
            for (const [methodProperty, method] of Object.entries(router.methods)) {
                this.routes.push({
                    router,
                    method: method.method,
                    path: '/' + [router.path, method.path].join('/'),
                    instance,
                    methodProperty,
                    inputs: method.params
                        .map(param => {
                            let validator: ZodObject | undefined = undefined
                            // Don't create a validator for service parameters
                            if (!['req', 'res', 'next', 'meta'].includes(param.source as any)) {
                                // Use the shared schema generator, which handles both primitives and DTOs
                                validator = generateSchema(param.type) as ZodObject
                            }
                            return {
                                ...param,
                                validator
                            }
                        })
                        .sort((a, b) => a.index - b.index),
                    responses: method.responses,
                    middlewares: method.middlewares || [],
                });
            }
        }
    }

    toOpenApi(): {
        paths: ZodOpenApiPathsObject,
        components?: { securitySchemes?: Record<string, ZodOpenApiSecuritySchemeObject> }
    } {
        const paths: ZodOpenApiPathsObject = {}
        const componentsSecuritySchemes: Record<string, ZodOpenApiSecuritySchemeObject> = {}
        for (const route of this.routes) {
            // Convert the express path ":param" → OpenAPI format "{param}" (all occurrences)
            const path = route.path.replace(/\/:(\w+)/g, '/{$1}')
            if (!paths[path]) {
                paths[path] = {}
            }
            paths[path][route.method] = {
                tags: [route.router.path],
                responses: {},
            }
            const parameters: any[] = []
            // Extract all parameter names from the original express path
            const pathParamNames = Array.from(route.path.matchAll(/:(\w+)/g)).map(m => m[1])
            for (const input of route.inputs) {
                switch (input.source) {
                    case "body":
                        paths[path][route.method].requestBody = {
                            content: {
                                'application/json': {schema: input.validator}
                            }
                        }
                        break
                    case "query":
                        paths[path][route.method].requestParams = {
                            query: input.validator as ZodObject
                        }
                        break
                }

                // Path parameters (the @Path decorator) → OpenAPI parameters[]
                if (input.source === 'params' && input.key) {
                    parameters.push({
                        name: input.key,
                        in: 'path',
                        required: true,
                        schema: generateSchema(input.type)
                    })
                }
            }

            // Add path parameters not declared via a decorator; default type — string
            if (pathParamNames.length) {
                const declared = new Set(parameters.map(p => p.name))
                for (const name of pathParamNames) {
                    if (!declared.has(name)) {
                        parameters.push({
                            name,
                            in: 'path',
                            required: true,
                            schema: z.string()
                        })
                    }
                }
            }

            if (parameters.length) {
                paths[path][route.method].parameters = parameters
            }

            // Collect openapi metadata from the middlewares
            const securityReqs: ZodOpenApiPathItemObject['get']['security'] = []
            for (const mw of route.middlewares || []) {
                if (!('openapi' in mw)) continue

                if (mw.openapi?.securitySchemes) {
                    for (const [name, scheme] of Object.entries(mw.openapi.securitySchemes)) {
                        if (!componentsSecuritySchemes[name]) componentsSecuritySchemes[name] = scheme
                        if (!securityReqs.find(s => Object.keys(s).includes(name))) {
                            securityReqs.push({[name]: []})
                        }
                    }
                }
            }
            if (securityReqs.length) {
                paths[path][route.method].security = securityReqs
            }

            // Group responses by status code and content-type
            const responsesByCode: Record<number, Record<string, any[]>> = {}
            // Types already recorded per code+content-type. The same response is easily declared twice —
            // a guard/rate-limit middleware contributes its own (see the Middleware decorator) and the
            // controller repeats it — and without this the two would become anyOf[X, X] in the spec.
            const typesByCode: Record<number, Record<string, Set<any>>> = {}
            const allResponses: TRouterResponse[] = [...route.responses]
            for (const response of allResponses) {
                if (!responsesByCode[response.code]) {
                    responsesByCode[response.code] = {}
                    typesByCode[response.code] = {}
                }

                // Auto-detect content-type if not specified
                const contentType = response.contentType || (response.type ? detectContentType(response.type) : 'application/json')

                if (response.type) {
                    if (!responsesByCode[response.code][contentType]) {
                        responsesByCode[response.code][contentType] = []
                        typesByCode[response.code][contentType] = new Set()
                    }
                    // Only a genuinely different type widens the response into a union.
                    if (typesByCode[response.code][contentType].has(response.type)) continue
                    typesByCode[response.code][contentType].add(response.type)
                    responsesByCode[response.code][contentType].push(generateSchema(response.type))
                }
            }

            if (!Object.keys(responsesByCode).length) {
                responsesByCode[200] = {'application/json': [z.object({})]}
            }

            // Every declared input is validated at runtime (handleRequest → validator.parse), and a
            // failure surfaces as a ZodValidationError → 400. Declare it from the route itself rather
            // than relying on each controller to remember: a hand-written list drifts (the skeleton
            // documented a 422 that nothing can return, while the 400 it DOES return went undeclared).
            // An explicit @ApiResponse(400) still wins — the check below leaves it alone.
            const validatesInput = route.inputs.some(input => input.validator)
            if (validatesInput && !allResponses.some(r => r.code === 400)) {
                const validationFailure: TRouterResponse = {
                    code: 400,
                    type: ErrorResponseDto,
                    description: 'Validation Error',
                }
                allResponses.push(validationFailure)
                responsesByCode[400] = {'application/json': [generateSchema(ErrorResponseDto)]}
            }

            // Generate OpenAPI responses with multiple content-types
            for (const [code, contentTypes] of Object.entries(responsesByCode)) {
                // Prefer whichever declaration actually carries a description: when a code comes from
                // both a middleware and the controller, only one of them tends to describe it.
                const described = allResponses.find(r => r.code === Number(code) && r.description)
                    ?? allResponses.find(r => r.code === Number(code))
                const content: Record<string, any> = {}

                for (const [contentType, schemas] of Object.entries(contentTypes)) {
                    content[contentType] = {
                        schema: schemas.length === 1 ? schemas[0] : z.union(schemas as [any, any, ...any[]])
                    }
                }

                paths[path][route.method].responses[code] = {
                    description: described?.description || '',
                    content
                }
            }

        }
        const result: { paths: ZodOpenApiPathsObject, components?: { securitySchemes?: Record<string, any> } } = {paths}
        if (Object.keys(componentsSecuritySchemes).length) {
            result.components = {securitySchemes: componentsSecuritySchemes}
        }
        return result;
    }

    toExpressRouter() {
        const root = express.Router()
        for (const route of this.routes) {
            console.log('Register Api Endpoint', route.method, route.path)
            root[route.method](route.path,
                // attach the recorded middlewares (wrapper objects are supported)
                ...route.middlewares.map(mw => 'handler' in mw ? mw.handler : mw),
                (req, res, next) =>
                    this.handleRequest(route, (...args) => route.instance[route.methodProperty](...args), route.inputs, req, res, next)
            );
        }
        return root
    }

    async handleRequest(route: Route, handler: any, inputs: Route['inputs'], req: Request, res: Response, next: NextFunction) {
        try {
            // prepare the available sources
            const availableParams = {
                body: req.body,
                query: req.query,
                params: req.params,
                headers: req.headers,
                req,
                res,
                next,
                meta: (req as any).meta || {},
            }

            const args: unknown[] = []
            for (const input of inputs) {
                // take the value from the source and the optional key (for path params)
                let raw: any = (availableParams as any)[input.source]
                if (input.key && raw && typeof raw === 'object') {
                    raw = raw[input.key]
                }

                // validation/type coercion via the shared validator (including primitives)
                let value: any = input.validator ? input.validator.parse(raw) : raw

                // map DTO classes
                if (typeof input.type === "function" && DtoStorage.has(input.type)) {
                    value = dataToDto(input.type, value)
                }

                args[input.index] = value
            }
            const result = await handler(...args)
            if (!res.headersSent) {
                if (typeof result === "string") {
                    res.send(result)
                } else {
                    res.json(result)
                }
            }
        } catch (e) {
            if (e instanceof ZodError) {
                next(new ZodValidationError(e.issues))
            } else {
                next(e)
            }
        }
    }
}
