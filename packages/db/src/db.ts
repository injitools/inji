import {z} from "zod";

import {
    DataSource,
    DeepPartial,
    EntityManager,
    EntityTarget,
    FindOptionsWhere,
    ObjectLiteral
} from "typeorm";

import {env} from "@injitools/core/runtime";

/**
 * Reads the database connection config from environment variables with the given prefix.
 * For example, loadDbConfigFromEnv('DB_MAIN_') reads DB_MAIN_HOST, DB_MAIN_PORT, ...
 */
export function loadDbConfigFromEnv(prefix = 'DB_') {
    return {
        host: env(prefix + "HOST", z.string()),
        port: env(prefix + "PORT", z.coerce.number().int()),
        username: env(prefix + "USERNAME", z.string()),
        password: env(prefix + "PASSWORD", "", z.string()),
        database: env(prefix + "DATABASE", 'test', z.string()),
    }
}

export async function dbConnect(db: DataSource) {
    await db.initialize()
    if (db.entityMetadatas.length === 0) {
        throw new Error(`no entities found in db ${db.name}`)
    }
    console.log(`db ${db.name} connected`)
}

export async function dbClose(db: DataSource) {
    await db.destroy()
    console.log(`db ${db.name} closed`)
}

export async function findOrCreate<Entity extends ObjectLiteral>(
    manager: EntityManager,
    target: EntityTarget<Entity>,
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
    defaults?: DeepPartial<Entity>,
): Promise<Entity> {
    let entity = await manager.findOneBy(target, where)
    if (!entity) {
        try {
            entity = manager.create(target, defaults || (where as DeepPartial<Entity>))
            await manager.save(entity)
        } catch (e) {
            if (e.message.includes('duplicate key value violates unique constraint')) {
                entity = await manager.findOneBy(target, where)
            } else {
                throw e
            }
        }
    }
    return entity
}

export async function updateOrCreate<Entity extends ObjectLiteral>(
    manager: EntityManager,
    target: EntityTarget<Entity>,
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
    defaults?: DeepPartial<Entity>,
): Promise<Entity> {
    let entity = await manager.findOneBy(target, where)
    if (!entity) {
        entity = manager.create(target, defaults || (where as DeepPartial<Entity>))
        await manager.save(entity)
    } else {
        //@ts-ignore
        await manager.update(target, where, defaults || (where as DeepPartial<Entity>))
        entity = await manager.findOneBy(target, where)
    }
    return entity
}
