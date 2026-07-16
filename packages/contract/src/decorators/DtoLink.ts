import DtoStorage, {DtoPropertyType} from "../storages/DtoStorage.js";

export default function DtoLink(dtoClass: Function): PropertyDecorator {
    return (target, propertyKey: string) => {
        DtoStorage.addProperty(target.constructor, propertyKey, {
            type: DtoPropertyType.DTO_LINK,
            class: dtoClass
        })
    }
}
