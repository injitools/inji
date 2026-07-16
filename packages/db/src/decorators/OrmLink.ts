import {ZodType} from "zod";
import {DtoStorage, DtoPropertyType} from "@injitools/core";

type OrmEntityConstructor = new (...args: any[]) => any;

/**
 * The schema derived from the column, as handed to `extend`. Typed loosely on purpose: the concrete
 * Zod class depends on the column type and is only known at runtime, so a precise type here would
 * force a cast on every call (`(s as ZodString).min(3)`).
 */
type DerivedSchema = any;

export interface OrmLinkOptions {
    /** ORM column name, when it differs from the DTO property name. */
    property?: string;
    /**
     * Force the field optional regardless of the DTO direction. For partial DTOs — e.g. an
     * update body where every column-backed field is optional — the type/length still derive
     * from the column, only the required-ness is overridden.
     */
    optional?: boolean;
    /**
     * Replace the schema derived from the column, while keeping the field LINKED to it: the
     * column still drives nullability/optionality, and a renamed or removed column still fails
     * loudly. Use when the wire form differs from the column's own type.
     *
     * @example @OrmLink({validation: z.string().uuid()}) external_id: string;
     */
    validation?: ZodType;
    /**
     * Extend the schema derived from the column instead of replacing it — the callback receives
     * the derived schema and returns a new one. Runs on the bare type, BEFORE the direction adds
     * `.nullable()`/`.optional()`, so refinements are available.
     *
     * @example @OrmLink({extend: (s) => s.min(3)}) login: string;   // derived max(64) + min(3)
     */
    extend?: (schema: DerivedSchema) => ZodType;
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
            validation: options.validation,
            extend: options.extend,
        })
    }
}
