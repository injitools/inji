// AUTO-GENERATED — do not edit by hand.
// Source: the API's OpenAPI document (ORM/DTO → zod → zod-openapi). Regenerate: npm run gen.

/**
 * bigint identifier. In JSON it arrives as a string (int64 does not fit in a number without
 * losing precision), but the branded type tells the receiving side it is a bigint: it is not
 * added as a number and is passed back as-is.
 */
export type Int64 = string & {readonly __int64: unique symbol};

export interface AuthUserDto {
    id: Int64;
    login: string;
    name: string;
    role: string;
}

export interface ErrorResponseDto {
    error: string;
    message: string;
    payload: unknown;
    inherit: string[];
}

export interface LoginDto {
    login: string;
    password: string;
}

export interface MessageDto {
    message: string;
}

export interface NewsDto {
    id: Int64;
    title: string;
    body: string;
    published: boolean;
    author?: string;
    created_at: string;
}

export interface RegisterDto {
    login: string;
    name: string;
    password: string;
}
