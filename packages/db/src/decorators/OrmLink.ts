import {DtoStorage, DtoPropertyType} from "@injitools/core";

type OrmEntityConstructor = new (...args: any[]) => any;

export interface OrmLinkOptions {
    /** ORM column name, when it differs from the DTO property name. */
    property?: string;
    /**
     * Force the field optional regardless of the DTO direction. For partial DTOs — e.g. an
     * update body where every column-backed field is optional — the type/length still derive
     * from the column, only the required-ness is overridden.
     */
    optional?: boolean;
}

export default function OrmLink(): PropertyDecorator;
export default function OrmLink<T extends OrmEntityConstructor>(
    ormPropertyKey: keyof InstanceType<T> & string
): PropertyDecorator;
export default function OrmLink(options: OrmLinkOptions): PropertyDecorator;

export default function OrmLink(arg?: string | OrmLinkOptions): PropertyDecorator {
    const options: OrmLinkOptions = typeof arg === "string" ? {property: arg} : (arg ?? {});
    return function (target, propertyKey: string) {
        DtoStorage.addProperty(target.constructor, propertyKey, {
            type: DtoPropertyType.ORM_LINK,
            ormProperty: options.property || propertyKey,
            optional: options.optional,
        })
    }
}
