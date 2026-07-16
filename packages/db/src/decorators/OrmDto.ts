import {RequestDto} from "@injitools/core";
import {DataSource} from "typeorm";

type TDtoClass = (new () => unknown) | Function;

/**
 * @deprecated A DTO's direction is now explicit. Use `@RequestDto(orm, db)` for input DTOs
 * or `@ResponseDto(orm, db)` for output DTOs. This alias keeps the historical input semantics
 * (`@OrmDto` was always used for request bodies).
 */
export default function OrmDto(ormClass: TDtoClass, db: DataSource): ClassDecorator {
    return RequestDto(ormClass, db);
}
