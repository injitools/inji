import {RequestHandler} from "express-serve-static-core";
import {sharedSingleton} from "@injitools/contract";
import RouterMiddleware from "../middlewares/RouterMiddleware.js";
import {VERSION} from "../../version.js";

export type ParamSource = "body" | "query" | "params" | "headers" | "req" | "res" | "next" | "meta";
export type TRouter = {
    path: string
}
export type TRouterRecord = TRouter & { methods: { [propertyKey: string]: TRouterMethodRecord } }

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type TRouterMethod = {
    method: HttpMethod,
    path: string
}
export type TRouterMethodRecord = TRouterMethod & {
    params: TRouterMethodParam[],
    responses: TRouterResponse[],
    middlewares: MiddlewareLike[],
}

export type TRouterResponse = {
    code: number
    description?: string
    type?: any
    contentType?: string
}

export type TRouterMethodParam = {
    index: number
    source: ParamSource
    type: any
    key?: string
}

export default class RoutesStorage {
    // Process-wide, not module-wide. This registry is where a guard lands: @RequireAdmin applies
    // @Middleware, which writes here, and InjiRouter reads it when building the express routes.
    // A duplicated copy of this package would split the two — the guard would be registered in one
    // registry and the router would read the other, so the route would be built WITHOUT it and the
    // endpoint would answer unauthorized callers with a 200. See sharedSingleton.
    private static registry = sharedSingleton(
        "core.routesRegistry",
        VERSION,
        () => new WeakMap<Function, TRouterRecord>(),
    )

    static get(routerClass: Function) {
        return this.registry.get(routerClass)
    }

    static register(routerClass: Function, info: TRouter = {path: ''}) {
        this.registry.set(routerClass, {
            ...info,
            methods: this.get(routerClass)?.methods || {}
        })
    }

    static addMethod(routerClass: Function, propertyKey: string, info: TRouterMethod) {
        let router = this.get(routerClass)
        if (!router) {
            this.register(routerClass)
            router = this.get(routerClass)
        }
        router.methods[propertyKey] = {
            ...info,
            params: router.methods[propertyKey]?.params || [],
            responses: router.methods[propertyKey]?.responses || [],
            middlewares: router.methods[propertyKey]?.middlewares || [],
        }
    }

    static addMethodParam(routerClass: Function, propertyKey: string, info: TRouterMethodParam) {
        let router = this.get(routerClass)
        if (!router) {
            this.register(routerClass)
            router = this.get(routerClass)
        }
        if (!router.methods[propertyKey]) {
            this.addMethod(routerClass, propertyKey, {} as TRouterMethod)
        }
        router.methods[propertyKey].params[info.index] = info
    }

    static addMethodResponse(routerClass: Function, propertyKey: string, info: TRouterResponse) {
        let router = this.get(routerClass)
        if (!router) {
            this.register(routerClass)
            router = this.get(routerClass)
        }
        if (!router.methods[propertyKey]) {
            this.addMethod(routerClass, propertyKey, {} as TRouterMethod)
        }
        router.methods[propertyKey].responses.push(info)
    }

    static addMethodMiddleware(routerClass: Function, propertyKey: string, mw: MiddlewareLike) {
        let router = this.get(routerClass)
        if (!router) {
            this.register(routerClass)
            router = this.get(routerClass)
        }
        if (!router.methods[propertyKey]) {
            this.addMethod(routerClass, propertyKey, {} as TRouterMethod)
        }
        router.methods[propertyKey].middlewares.push(mw)
    }
}

export type MiddlewareLike = RequestHandler | RouterMiddleware
