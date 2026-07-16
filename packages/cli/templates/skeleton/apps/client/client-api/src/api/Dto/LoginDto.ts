import {z} from "zod";
import {RequestDto, DtoProperty} from "@injitools/core";

// Login request body. A pure REQUEST DTO: no field is bound to an ORM column
// (the password is never stored in clear text), so validation is defined with explicit zod schemas.
@RequestDto()
export class LoginDto {
    @DtoProperty({validation: z.string().min(3).max(64)})
    login: string;

    @DtoProperty({validation: z.string().min(6).max(128)})
    password: string;
}
