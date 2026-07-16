import {Router, Get, Response as ApiResponse} from "@injitools/core";

import {UserService, RequireAdmin} from "@app/domain";
import UserOrm from "@app/domain/db/entities/UserOrm";

import {UserDto} from "../Dto/UserDto.js";

// Projects a user entity into the admin's full view.
function toUserDto(u: UserOrm): UserDto {
    return {
        id: u.id,
        login: u.login,
        name: u.name,
        role: u.role,
        created_at: u.created_at.toISOString(),
        last_seen: u.last_seen ? u.last_seen.toISOString() : undefined,
    };
}

@Router("users")
export default class UsersApi {
    // GET /users — list of users. The @RequireAdmin guard returns 401/403 itself and marks
    // the endpoint in OpenAPI with the cookie-session security scheme.
    @Get()
    @RequireAdmin()
    @ApiResponse(200, UserDto)
    async list(): Promise<UserDto[]> {
        const users = await UserService.list();
        return users.map(toUserDto);
    }
}
