import RoutesStorage, {ParamSource} from "../storages/RoutesStorage.js";

function Param(source: ParamSource): ParameterDecorator {
    return (target, propertyKey: string, index) => {
        const paramTypes = Reflect.getMetadata('design:paramtypes', target.constructor.prototype, propertyKey) as Function[];
        RoutesStorage.addMethodParam(target.constructor, propertyKey, {
            index,
            source,
            type: paramTypes[index]
        })
    }
}

export const Body = () => Param("body")
export const Query = () => Param("query")
export const Params = () => Param("params")
export const Headers = () => Param("headers")
export const Req = () => Param("req")
export const Res = () => Param("res")
export const Next = () => Param("next")
export const Meta = (key: string) => {
    const decorator: ParameterDecorator = (target, propertyKey: string, index) => {
        const paramTypes = Reflect.getMetadata('design:paramtypes', target.constructor.prototype, propertyKey) as Function[];
        RoutesStorage.addMethodParam(target.constructor, propertyKey, {
            index,
            source: 'meta',
            type: paramTypes[index],
            key,
        })
    }
    return decorator
}
