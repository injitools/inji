import DtoStorage, {DtoType} from "../storages/DtoStorage.js";

/**
 * Marks a class as a **request** DTO (an input body/query). Optionally binds it to a TypeORM
 * entity so that @OrmLink() fields derive their type/validation from the column metadata with
 * INPUT semantics: generated/default/nullable columns become optional (a client omits what the
 * server fills in), strings/dates coerce from the wire.
 *
 * Pass no arguments for a pure contract request DTO (no table behind it, e.g. LoginDto).
 * The `db` value is stored opaquely, so this decorator stays free of a typeorm import.
 */
export default function RequestDto(ormClass?: Function, db?: unknown): ClassDecorator {
    return (dtoClass) => {
        DtoStorage.register(dtoClass, ormClass
            ? {type: DtoType.ORM_DTO, ormClass, db, direction: "request"}
            : {type: DtoType.STRUCT, direction: "request"});
    };
}
