import {createHash} from "node:crypto";
import {DataSource} from "typeorm";

import {Middleware, createMiddleware, ErrorResponseDto} from "@injitools/core";
import ApiKeyOrm from "../entities/ApiKeyOrm.js";
import {AuthError} from "../errors/AuthError.js";

export type BearerAuthOptions<User = any> = {
    db: DataSource
    /** Keys entity. Defaults to the built-in ApiKeyOrm. */
    apiKeyEntity?: typeof ApiKeyOrm
    /** Loads the user by the user_id of the matched key. */
    loadUser: (userId: bigint, db: DataSource) => Promise<User | null>
    /**
     * Hash the presented key before looking it up in the DB (RECOMMENDED).
     * Then the hash column must hold sha256(key). Defaults to false —
     * compatible with storing the key in plaintext.
     */
    hashKey?: boolean
}

/**
 * Factory for a Bearer-authorization method decorator. Puts the user into req.meta.user
 * and registers the `bearerAuth` security scheme in OpenAPI.
 */
export default function createBearerAuth<User = any>(options: BearerAuthOptions<User>) {
    const entity = options.apiKeyEntity ?? ApiKeyOrm

    return function BearerAuth(): MethodDecorator {
        const handler = async (req: any, _res: any, next: Function) => {
            try {
                const authHeader = req.headers?.authorization
                if (!authHeader || !authHeader.startsWith('Bearer '))
                    throw new AuthError("Not authorized")

                let apiKey = authHeader.slice(7)
                if (!apiKey) throw new AuthError("Not authorized")
                if (options.hashKey) {
                    apiKey = createHash('sha256').update(apiKey).digest('hex')
                }

                const keyRecord = await options.db.manager.findOneBy(entity, {hash: apiKey} as any)
                if (!keyRecord) throw new AuthError("Invalid API key")

                const user = await options.loadUser(keyRecord.user_id, options.db)
                if (!user) throw new AuthError("User not found")

                req.meta = req.meta || {}
                req.meta.user = user

                next()
            } catch (e) {
                next(e)
            }
        }

        const mw = createMiddleware(handler)
            .security('bearerAuth', {type: 'http', scheme: 'bearer'})
            .responses({code: 401, description: 'Unauthorized', type: ErrorResponseDto})

        return Middleware(mw)
    }
}
