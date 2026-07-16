import DtoStorage, {DtoPropertyType, TDtoPrimitiveProperty} from "../storages/DtoStorage.js";

export default function DtoProperty(options?: TDtoPrimitiveProperty['options']): PropertyDecorator {
    return (target, propertyKey: string) => {
        DtoStorage.addProperty(target.constructor, propertyKey, {
            type: DtoPropertyType.PRIMITIVE,
            primitive: Reflect.getMetadata('design:type', target.constructor.prototype, propertyKey),
            options
        })
    }
}
