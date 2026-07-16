import type {Request, Response} from "express";

import {Router, Get, Post, Body, Req, Res, Meta, Response as ApiResponse, ErrorResponseDto, RequestError} from "@injitools/core";

import {UserService, startSession, endSession, RequireUser} from "@app/domain";
import UserOrm from "@app/domain/db/entities/UserOrm";

import {LoginDto} from "../Dto/LoginDto.js";
import {MessageDto} from "../Dto/MessageDto.js";
import {AuthUserDto} from "../Dto/AuthUserDto.js";

// Admin auth controller (admin-api) — its OWN controller, NOT shared with client-api. It reuses the
// domain UserService.authenticate + cookie session, but enforces an ADMIN-ONLY login policy (403 for
// non-admins). This is exactly why apps own their controllers: same domain logic, a different auth
// policy per surface. No register here (admins are seeded).

// Projects a user entity into the signed-in admin's slim shape.
function toAuthUser(u: UserOrm): AuthUserDto {
    return {id: u.id, login: u.login, name: u.name, role: u.role};
}

@Router("auth")
export default class AuthApi {
    // POST /auth/login — admins only. Verifies the password and rejects non-admins (403).
    @Post("login")
    @ApiResponse(200, AuthUserDto)
    @ApiResponse(401, ErrorResponseDto)
    @ApiResponse(403, ErrorResponseDto)
    async login(@Body() body: LoginDto, @Res() res: Response): Promise<AuthUserDto> {
        const user = await UserService.authenticate(body.login, body.password);
        if (!user) throw new RequestError(401, "Invalid login or password", "Unauthorized");
        if (user.role !== "admin") throw new RequestError(403, "Administrator access only", "Forbidden");
        await startSession(res, user.id);
        return toAuthUser(user);
    }

    // POST /auth/logout — ends the session and clears the cookie.
    @Post("logout")
    @ApiResponse(200, MessageDto)
    async logout(@Req() req: Request, @Res() res: Response): Promise<MessageDto> {
        await endSession(req, res);
        return {message: "ok"};
    }

    // GET /auth/me — the current admin from the cookie session (401 if not logged in).
    @Get("me")
    @RequireUser()
    @ApiResponse(200, AuthUserDto)
    async me(@Meta("user") user: UserOrm): Promise<AuthUserDto> {
        return toAuthUser(user);
    }
}
