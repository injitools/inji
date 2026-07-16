import {z, ZodType} from "zod";
import {DataSource} from "typeorm";
import type {DtoDirection} from "@injitools/core";

/**
 * Generates a Zod schema from the metadata of a TypeORM ORM column.
 * Used by the core through the setOrmZodResolver hook (see index.ts).
 *
 * `direction` decides how column metadata maps to the wire (a column is a single source of
 * truth for both directions, but the shapes differ):
 *  • "request"  (input)  — generated/default/nullable → optional; dates coerce from the wire.
 *  • "response" (output) — optional only when the column is nullable (generated/defaulted values
 *                          are always present); date columns are serialized as ISO strings.
 */
export function generateOrmZodValidation(
    db: DataSource,
    ormClass: Function,
    ormProperty: string,
    direction: DtoDirection = "request",
): ZodType {
    const ormMeta = db.getMetadata(ormClass)
    const columnMeta = ormMeta.findColumnWithPropertyName(ormProperty)

    // @OrmLink points to a non-existent column - the most common cause: the column was removed from the
    // entity (for example, the property was moved out into *_facts) while the @OrmLink property in the DTO
    // still references it. Without an explicit error this would fail further down as
    // "Cannot read properties of undefined (reading 'type')" without naming the culprit. Name the
    // entity/property explicitly.
    if (!columnMeta) {
        const known = ormMeta.columns.map((c) => c.propertyName).join(', ')
        throw new Error(
            `@OrmLink: property "${ormProperty}" does not match any column of the ORM entity ` +
            `"${ormMeta.targetName || ormMeta.name}". Remove @OrmLink from this DTO property or fix the ` +
            `name. Available columns: [${known}].`
        )
    }

    let schema: ZodType

    switch (columnMeta.type) {
        case 'bigint':
        case 'int64':
        case 'unsigned big int':
            schema = z.coerce.bigint()
                .max(columnMeta.unsigned ? 2n ** 64n - 1n : 2n ** 63n - 1n)
                .min(columnMeta.unsigned ? 0n : -(2n ** 63n))
            break

        case Number:
        case 'int':
        case 'integer':
            schema = z.coerce.number()
                .int()
                .max(columnMeta.unsigned ? 2 ** 32 - 1 : 2 ** 31 - 1)
                .min(columnMeta.unsigned ? 0 : -(2 ** 31))
            break

        case 'mediumint':
            schema = z.coerce.number()
                .int()
                .max(columnMeta.unsigned ? 2 ** 24 - 1 : 2 ** 23 - 1)
                .min(columnMeta.unsigned ? 0 : -(2 ** 23))
            break

        case 'smallint':
            schema = z.coerce.number()
                .int()
                .max(columnMeta.unsigned ? 2 ** 16 - 1 : 2 ** 15 - 1)
                .min(columnMeta.unsigned ? 0 : -(2 ** 15))
            break

        case 'tinyint':
            schema = z.coerce.number()
                .int()
                .max(columnMeta.unsigned ? 2 ** 8 - 1 : 2 ** 7 - 1)
                .min(columnMeta.unsigned ? 0 : -(2 ** 7))
            break

        case 'dec':
        case 'decimal':
        case 'smalldecimal':
        case 'fixed':
        case 'numeric':
        case 'real':
        case 'float':
        case 'float4':
        case 'float8':
        case 'float64':
        case 'double':
        case 'double precision':
        case 'number':
        case 'smallmoney':
        case 'money':
            schema = z.coerce.number()
            break

        case Boolean:
        case 'boolean':
        case 'bool':
            schema = z.coerce.boolean()
            break

        case Date:
        case 'datetime':
        case 'datetime2':
        case 'datetimeoffset':
        case 'time':
        case 'time with time zone':
        case 'time without time zone':
        case 'timestamp':
        case 'timestamp without time zone':
        case 'timestamp with time zone':
        case 'timestamp with local time zone':
        case 'timetz':
        case 'timestamptz':
        case 'smalldatetime':
        case 'date':
        case 'year':
        case 'seconddate':
            // On the wire a response carries an ISO string, while the entity holds a Date.
            // Input coerces a string/number/Date → Date; output stays an ISO string.
            schema = direction === "response" ? z.iso.datetime({offset: true}) : z.coerce.date()
            break

        case String:
        case 'character varying':
        case 'varying character':
        case 'char varying':
        case 'nvarchar':
        case 'national varchar':
        case 'character':
        case 'native character':
        case 'varchar':
        case 'char':
        case 'nchar':
        case 'national char':
        case 'varchar2':
        case 'nvarchar2':
        case 'alphanum':
        case 'shorttext':
        case 'tinytext':
        case 'mediumtext':
        case 'text':
        case 'ntext':
        case 'citext':
        case 'bytes':
        case 'bytea':
        case 'long':
        case 'raw':
        case 'long raw':
        case 'bfile':
        case 'clob':
        case 'nclob':
        case 'image':
        case 'xml':
        case 'inet':
        case 'inet4':
        case 'inet6':
        case 'cidr':
        case 'macaddr':
        case 'macaddr8':
        case 'bit':
        case 'bit varying':
        case 'varbit':
        case 'hierarchyid':
        case 'sql_variant':
        case 'rowid':
        case 'urowid':
        case 'uniqueidentifier':
        case 'rowversion':
            schema = z.string()
            if (columnMeta.length) {
                schema = (schema as z.ZodString).max(Number(columnMeta.length))
            }
            break

        case 'uuid':
            schema = z.uuid()
            break

        case 'json':
        case 'jsonb':
        case 'simple-json':
            schema = z.unknown()
            break

        case 'simple-array':
            schema = z.array(z.string())
            break

        case 'array':
            schema = z.array(z.unknown())
            break

        case 'simple-enum':
        case 'enum':
        case 'set':
            if (Array.isArray(columnMeta.enum) && columnMeta.enum.length > 0) {
                schema = z.enum(columnMeta.enum as [string, ...string[]])
            } else {
                schema = z.string()
            }
            break

        case 'binary':
        case 'varbinary':
        case 'tinyblob':
        case 'mediumblob':
        case 'blob':
        case 'longblob':
            schema = z.string()
            break

        default:
            schema = z.unknown()
            break
    }


    if (columnMeta.isArray && columnMeta.type !== 'simple-array' && columnMeta.type !== 'array') {
        schema = z.array(schema)
    }

    if (direction === "response") {
        // Output: a field is optional only when the column is nullable — the mapper turns a
        // null column into an absent field (`x ?? undefined`), so we want `x?: T`, not `T | null`.
        // Generated/defaulted values are always present in a response → required.
        if (columnMeta.isNullable) {
            schema = schema.optional()
        }
    } else {
        // Input: a client omits nullable columns and anything the server fills in (generated /
        // defaulted) → optional; a nullable column additionally accepts an explicit null.
        if (columnMeta.isNullable) {
            schema = schema.nullable()
        }
        if (columnMeta.isGenerated || columnMeta.default !== undefined || columnMeta.isNullable) {
            schema = schema.optional()
        }
    }

    return schema
}
