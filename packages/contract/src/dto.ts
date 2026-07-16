import DtoStorage, {DtoPropertyType, TDtoClass} from "./storages/DtoStorage.js";

export function dataToDto(dtoClass: TDtoClass, data: any) {
    const dto = DtoStorage.get(dtoClass)
    // @ts-expect-error — construct an instance of the DTO class
    const dtoEntity = new dtoClass
    for (const [property, options] of Object.entries(dto.properties)) {
        if (options.type === DtoPropertyType.DTO_LINK) {
            if (options.array) {
                dtoEntity[property] = data[property].map(item => dataToDto(options.class, item))
            } else {
                dtoEntity[property] = dataToDto(options.class, data[property])
            }
        } else {
            dtoEntity[property] = data[property]
        }
    }
    return dtoEntity
}
