import {ZodType} from "zod";

export type TDtoClass = (new () => unknown) | Function

/**
 * Direction of a DTO — a first-class distinction (see RequestDto/ResponseDto).
 *  • "request"  — an input DTO (@Body/@Query): generated/default/nullable columns are optional,
 *                 dates coerce from strings. A client omits what the server fills in.
 *  • "response" — an output DTO (@Response): a field is optional only when the column is nullable;
 *                 dates are serialized as ISO strings. Generated/defaulted values are always present.
 * A single DTO class must not be reused for both directions.
 */
export type DtoDirection = "request" | "response"

export type TDtoStruct = {
    type: DtoType.STRUCT
    direction: DtoDirection
}

/**
 * ORM DTO. The `db` and `ormClass` fields are intentionally typed as `unknown`/`Function`,
 * so that the core (@injitools/core) does not depend on typeorm. The real types are known by @injitools/db.
 */
export type TDtoOrm = {
    type: DtoType.ORM_DTO
    ormClass: (new () => unknown) | Function,
    db: unknown
    direction: DtoDirection
}
export type TDto = TDtoStruct | TDtoOrm
export type TDtoRecord = TDto & { properties: { [propertyKey: string]: TDtoProperty } }

export type TDtoLinkProperty = {
    type: DtoPropertyType.DTO_LINK
    class: TDtoClass
    array?: boolean
}

export type TOrmLinkProperty = {
    type: DtoPropertyType.ORM_LINK
    ormProperty: string
    // Forces the field optional regardless of the class direction — for partial DTOs
    // (e.g. an update body where every column-backed field is optional).
    optional?: boolean
}

export type TDtoPrimitiveProperty = {
    type: DtoPropertyType.PRIMITIVE
    primitive: StringConstructor | NumberConstructor | BooleanConstructor | BigIntConstructor | DateConstructor
    options?: { optional?: boolean, validation?: ZodType }
}

export type TDtoProperty = TDtoLinkProperty | TOrmLinkProperty | TDtoPrimitiveProperty

export enum DtoType {
    STRUCT = 'struct',
    ORM_DTO = 'dtoOrm'
}

export enum DtoPropertyType {
    DTO_LINK = 'dtoLink',
    ORM_LINK = 'ormLink',
    PRIMITIVE = 'primitive',
}

export default class DtoStorage {
    private static registry = new WeakMap<TDtoClass, TDtoRecord>()

    static has(dtoClass: TDtoClass) {
        return this.registry.has(dtoClass)
    }

    static get(dtoClass: TDtoClass) {
        return this.registry.get(dtoClass)
    }

    static register(dtoClass: TDtoClass, info: TDto = {
        type: DtoType.STRUCT,
        direction: "request",
    }) {
        this.registry.set(dtoClass, {
            ...info,
            properties: this.get(dtoClass)?.properties || {}
        })
    }

    static addProperty(dtoClass: TDtoClass, propertyKey: string, info: TDtoProperty) {
        let dto = this.get(dtoClass)
        if (!dto) {
            this.register(dtoClass)
            dto = this.get(dtoClass)
        }
        dto.properties[propertyKey] = info
    }
}
