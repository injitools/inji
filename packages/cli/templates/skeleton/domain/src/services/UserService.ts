import {RequestError} from "@injitools/core";

import {dbMain} from "../db/dataSource.js";
import UserOrm from "../db/entities/UserOrm.js";
import {hashPassword, verifyPassword} from "../auth/password.js";

// Domain service for users/credentials: shared business logic behind both apps' auth endpoints.
// Returns UserOrm entities — each app projects them into its own DTO (a public AuthUserDto for the
// client, the fuller UserDto for the admin list). Session cookies live in domain/auth (startSession).

export interface RegisterInput {
    login: string;
    name: string;
    password: string;
}

export default class UserService {
    /** Creates a user (role "user"). Throws 409 if the login is taken. */
    static async register(input: RegisterInput): Promise<UserOrm> {
        const exists = await dbMain.manager.findOneBy(UserOrm, {login: input.login} as any);
        if (exists) throw new RequestError(409, "Login already taken", "Conflict");

        const user = dbMain.manager.create(UserOrm, {
            login: input.login,
            name: input.name,
            password_hash: hashPassword(input.password),
            role: "user",
        } as any);
        await dbMain.manager.save(user);
        return user;
    }

    /** Verifies login + password. Returns the user on success, null otherwise (caller maps to 401). */
    static async authenticate(login: string, password: string): Promise<UserOrm | null> {
        const user = await dbMain.manager.findOneBy(UserOrm, {login} as any);
        if (!user || !verifyPassword(password, user.password_hash)) return null;
        return user;
    }

    static async list(): Promise<UserOrm[]> {
        return dbMain.manager.find(UserOrm, {order: {created_at: "DESC"} as any});
    }
}
