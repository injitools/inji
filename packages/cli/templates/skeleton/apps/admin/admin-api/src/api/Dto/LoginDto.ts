import {z} from "zod";
import {RequestDto, DtoProperty} from "@injitools/core";

// Admin login request body. A pure REQUEST DTO (the password is never a stored column).
// A per-app copy: the admin app owns its own auth DTOs, even where they mirror the client's — apps
// do not share controllers or their DTOs; they share only the domain UserService.
@RequestDto()
export class LoginDto {
    @DtoProperty({validation: z.string().min(3).max(64)})
    login: string;

    @DtoProperty({validation: z.string().min(6).max(128)})
    password: string;
}
