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

export interface CreateNewsDto {
    title: string;
    body: string;
    published?: boolean;
    publish_at?: string;
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
    publish_at?: string;
    author?: string;
    created_at: string;
    updated_at: string;
}

export interface UpdateNewsDto {
    title?: string;
    body?: string;
    published?: boolean;
    publish_at?: string;
}

export interface UserDto {
    id: Int64;
    login: string;
    name: string;
    role: string;
    created_at: string;
    last_seen?: string;
}
