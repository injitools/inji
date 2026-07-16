import DtoStorage, {DtoType} from "../storages/DtoStorage.js";

/**
 * Marks a class as a **response** DTO (an output payload). Optionally binds it to a TypeORM
 * entity so that @OrmLink() fields derive their type/validation from the column metadata with
 * OUTPUT semantics: a field is optional only when the column is nullable (generated/defaulted
 * values are always present in a response), and date columns are serialized as ISO strings.
 *
 * Pass no arguments for a pure contract response DTO (no table behind it, e.g. MessageDto).
 * The `db` value is stored opaquely, so this decorator stays free of a typeorm import.
 */
export default function ResponseDto(ormClass?: Function, db?: unknown): ClassDecorator {
    return (dtoClass) => {
        DtoStorage.register(dtoClass, ormClass
            ? {type: DtoType.ORM_DTO, ormClass, db, direction: "response"}
            : {type: DtoType.STRUCT, direction: "response"});
    };
}
