import RoutesStorage from "../storages/RoutesStorage.js";
import type {MiddlewareLike} from "../storages/RoutesStorage.js";
import RouterMiddleware from "../middlewares/RouterMiddleware.js";

export default function Middleware(...handlers: MiddlewareLike[]): MethodDecorator {
    return (target, propertyKey: string) => {
        for (const h of handlers) {
            RoutesStorage.addMethodMiddleware(target.constructor, propertyKey, h)
            // If this is a RouterMiddleware with openapi metadata — register its responses on the route
            if (h instanceof RouterMiddleware && h.openapi?.responses?.length) {
                for (const resp of h.openapi.responses) {
                    RoutesStorage.addMethodResponse(target.constructor, propertyKey, resp)
                }
            }
        }
    }
}
