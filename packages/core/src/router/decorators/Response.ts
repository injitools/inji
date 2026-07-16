import RoutesStorage from "../storages/RoutesStorage.js";

export function Response(code: number, type?: any, description?: string, contentType?: string): MethodDecorator {
    return (target, propertyKey: string) => {
        RoutesStorage.addMethodResponse(target.constructor, propertyKey, {
            code,
            type,
            description,
            contentType
        })
    }
}
