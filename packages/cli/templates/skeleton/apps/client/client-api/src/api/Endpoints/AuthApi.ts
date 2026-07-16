import type {Request, Response} from "express";

import {Router, Get, Post, Body, Req, Res, Meta, Response as ApiResponse, ErrorResponseDto, RequestError} from "@injitools/core";

import {UserService, startSession, endSession, RequireUser, RateLimit} from "@app/domain";
import UserOrm from "@app/domain/db/entities/UserOrm";

import {LoginDto} from "../Dto/LoginDto.js";
import {RegisterDto} from "../Dto/RegisterDto.js";
import {AuthUserDto} from "../Dto/AuthUserDto.js";
import {MessageDto} from "../Dto/MessageDto.js";

// Public auth controller (client-api). Thin: parse the DTO → call a domain service → project the
// entity into this app's AuthUserDto. The admin app declares its OWN auth controller; the shared
// part is UserService + the cookie session (domain), never a shared controller.

// Projects a user entity into the client's public shape.
function toAuthUser(user: UserOrm): AuthUserDto {
    return {id: user.id, login: user.login, name: user.name, role: user.role};
}

@Router("auth")
export default class AuthApi {
    // POST /auth/register — creates a user and a session (cookie sid).
    // Rate-limited to 5/hour per IP: register must report WHY it fails (409 "login taken"), which
    // doubles as a login-enumeration oracle — the hourly cap keeps that (and brute-force) in check.
    // Unblock during development with `npm run ratelimit:reset -- register`.
    // Only 409 is declared here: 400 comes from the validated @Body and 429 from @RateLimit — both
    // add themselves to OpenAPI, the same way @RequireUser adds its 401 to `me` below.
    @Post("register")
    @RateLimit({bucket: "register", limit: 5, windowMs: 60 * 60 * 1000})
    @ApiResponse(200, AuthUserDto)
    @ApiResponse(409, ErrorResponseDto, "Login already taken")
    async register(@Body() body: RegisterDto, @Res() res: Response): Promise<AuthUserDto> {
        const user = await UserService.register(body);
        await startSession(res, user.id);
        return toAuthUser(user);
    }

    // POST /auth/login — verifies the password and starts a session (cookie sid).
    @Post("login")
    @ApiResponse(200, AuthUserDto)
    @ApiResponse(401, ErrorResponseDto)
    async login(@Body() body: LoginDto, @Res() res: Response): Promise<AuthUserDto> {
        const user = await UserService.authenticate(body.login, body.password);
        if (!user) throw new RequestError(401, "Invalid login or password", "Unauthorized");
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

    // GET /auth/me — the current user from the cookie session (401 if not logged in).
    // The @RequireUser guard puts the user in req.meta.user and adds the 401 to OpenAPI itself.
    @Get("me")
    @RequireUser()
    @ApiResponse(200, AuthUserDto)
    async me(@Meta("user") user: UserOrm): Promise<AuthUserDto> {
        return toAuthUser(user);
    }
}
