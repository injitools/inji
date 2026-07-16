import RoutesStorage from "../storages/RoutesStorage.js";

// Decorator for extracting named variables from the path (Express params)
export default function Path(key: string): ParameterDecorator {
    return (target, propertyKey: string, index) => {
        const paramTypes = Reflect.getMetadata(
            'design:paramtypes',
            target.constructor.prototype,
            propertyKey
        ) as Function[];

        RoutesStorage.addMethodParam(target.constructor, propertyKey, {
            index,
            source: 'params',
            type: paramTypes[index],
            key
        })
    }
}
